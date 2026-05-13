# Release Procedure — full-stack PRD rollout

**Audience:** the engineer shipping a feature that spans the orchestrator, the widget SDK, the Shopify theme extension, and/or the agent skills.
**Time estimate:** 15-30 min for a clean run across all layers.
**Last updated:** 2026-05-13 (PRD-007 release)

---

## When to use this runbook

Any change that touches more than one of these:

| Layer | Repo | Deploy target |
|---|---|---|
| Orchestrator API + workspace seeding | `automatos-ai` | Railway (auto on push to `main`) |
| Agent skills (SKILL.md prompts) | `automatos-skills` | Loaded from disk at agent runtime — push to `main` |
| Widget SDK runtime (loader, chat-widget, blog-widget) | `automatos-widget-sdk` | S3 + CloudFront via `pnpm deploy:cdn` |
| Theme extension (Liquid blocks + page-context attrs) | `automatos-shopify` | Shopify Partner app version via `shopify app deploy` |

Changes inside one layer only (e.g. a doc fix, a single API tweak) can skip this and just merge + deploy that one repo. Use this when a feature has cross-cutting components — typical for new PRDs.

---

## Architecture (5-second refresher)

```
Storefront (merchant.myshopify.com)
   │
   │  loads from CDN ──────────────────────────────────┐
   │                                                    ▼
   │  <script src="widgets.automatos.app/v0/widget.global.js">
   │       │                                                       (S3 + CloudFront)
   │       │  POST /api/widgets/chat ─────────────────┐
   │       │  GET  /api/widgets/config                │
   │       │                                          ▼
   ▼                                          api.automatos.app
Shopify Theme Extension                           (Railway)
(chat-widget.liquid + page-context data attrs)         │
   │                                                    │ loads agent prompt from disk
   │  installed by shopify app deploy                   ▼
   │  released in merchant's Dev Dashboard      automatos-skills/
                                                shopify/shopify-support/SKILL.md
                                                (git checkout on the orchestrator's
                                                 skills volume)
```

The order of deploys matters because of these data-flow dependencies — see next section.

---

## Order of operations

**Backend → Bundles → Edge.** Each downstream layer is forward-compatible with the previous layer's old version (graceful degrade), but only fully active after the upstream lands.

| Order | Layer | Why this order | Rollback safety |
|---|---|---|---|
| **1** | Orchestrator (Railway) | Defines new endpoints / fields. SDK calling them before this would 404 — harmless but pointless. | Roll back via git revert + Railway redeploy. |
| **2** | Skills (`automatos-skills`) | Agent prompts that the new orchestrator fields rely on. Push before the orchestrator behaviour goes live. Often deployable in parallel with step 1. | `git revert` on `main` — orchestrator picks up the change on its next agent invocation. |
| **3** | SDK CDN (S3/CloudFront) | New runtime that calls the new endpoints. Old theme blocks ignore unknown init keys, so deploying SDK before the theme is safe — the new SDK on the old theme just has nothing extra to do. | Restore previous immutable version → repoint `v0/` alias (see `widget-sdk-rollback.md`). |
| **4** | Theme extension (Shopify) | Liquid changes that pass new fields to the SDK. With the new SDK already on the CDN, this flips the feature live on the merchant's preview/store. | Deploy a previous app version + release. |

If you deploy in a different order: nothing breaks. Things just don't activate until everything is in place. Common safe-degraded states:

- Theme deployed before SDK → new data attrs sit in DOM, old SDK ignores them. Chat still works.
- SDK deployed before orchestrator → SDK calls `/api/widgets/config`, gets 404, swallows the failure (per `config-fetcher.ts`), proactive stays dormant.
- Skills deployed before orchestrator → no effect until orchestrator hits the proactive code path.

---

## Step 1 — Orchestrator (Railway)

**Branch:** feature branch from `main` (e.g. `feat/prd-007-proactive-engagement`).
**Files typically touched:** `orchestrator/api/widgets/*.py`, `orchestrator/api/shopify.py`, `orchestrator/core/models/workspaces.py`, new tests under `orchestrator/tests/`.

```bash
cd ~/Development/Automatos-AI-Platform/automatos-ai

# 1. Verify changed files
git status

# 2. Run new unit tests locally
cd orchestrator && python -m pytest tests/test_<your_feature>.py -q
cd ..

# 3. Push the feature branch
git push -u origin feat/prd-XXX-feature-name

# 4. Open PR, merge to main (or fast-track if hot-fix)
# 5. Railway auto-deploys from main — watch the build log on railway.app
```

### Smoke test after deploy

```bash
# Health
curl https://api.automatos.app/api/widgets/health
# → {"status":"ok","version":"1.0"}

# Any new endpoint
curl https://api.automatos.app/api/widgets/<new-endpoint> \
  -H "Authorization: Bearer ak_pub_<any-test-key>" \
  -H "Origin: https://<test-store>.myshopify.com"
```

### Database migrations

`workspace.settings` is `JSONB` — most PRD work just adds keys to that blob. No migration needed. If you ARE adding columns/tables: ship the migration via the existing Alembic chain BEFORE merging the code that depends on them.

---

## Step 2 — Skills (`automatos-skills`)

**Branch:** feature branch from `main` (e.g. `feat/prd-007-proactive-opener-skill`).
**Files typically touched:** `shopify/<skill-name>/SKILL.md` (markdown only, no tests).

```bash
cd ~/Development/Automatos-AI-Platform/automatos-skills
git push -u origin feat/prd-XXX-skill-update
# Merge to main via PR
```

The orchestrator reads `SKILL.md` from disk at agent invocation time — no service restart needed. New invocations pick up the new prompt within seconds of the merge propagating to the skills volume.

### Smoke test after merge

Invoke an agent that uses the updated skill (via the dashboard or widget) — confirm the new behaviour. If the change is to the prompt, the agent's response style should reflect it on the next message.

---

## Step 3 — Widget SDK (CDN)

**Branch:** feature branch from `main` (e.g. `feat/prd-007-proactive-engagement`).
**Files typically touched:** `packages/core/src/types.ts`, `packages/loader/src/**`, `packages/chat-widget/src/**`, new tests under `packages/*/src/__tests__/`.

### Pre-flight

```bash
cd ~/Development/Automatos-AI-Platform/automatos-widget-sdk

# Bump both package versions in lockstep
sed -i '' 's/"version": "0.X.Y"/"version": "0.X.Z"/' packages/loader/package.json
sed -i '' 's/"version": "0.X.Y"/"version": "0.X.Z"/' packages/core/package.json

# Verify locally
pnpm install
pnpm typecheck
pnpm test         # all packages
pnpm build        # produces packages/loader/dist/widget.global.js

# Commit + push
git add -A
git commit -m "feat: <description>"
git push -u origin feat/prd-XXX-feature-name
```

### Deploy to CDN

```bash
pnpm deploy:cdn vX.Y.Z
```

The script (`scripts/deploy-cdn.sh`):

- **Auto-loads AWS creds** from `../automatos-ai/orchestrator/.env` if your shell doesn't have them set. So in this monorepo you don't have to `aws configure` or `aws sso login` first.
- **Auto-detects the CloudFront distribution** for `widgets.automatos.app` — no need to look up `DISTRIBUTION_ID`.
- Uploads to immutable path `s3://automatos-widget-sdk/vX.Y.Z/` (1-year cache).
- Repoints `s3://automatos-widget-sdk/v0/` alias at the new version (1-hour cache).
- Invalidates CloudFront on `/v0/*`.
- Smoke-tests `https://widgets.automatos.app/v0/widget.global.js` with 24× retry over 2 min.

```bash
pnpm deploy:cdn vX.Y.Z --dry-run    # preview commands without uploading
```

Refuses to overwrite an existing immutable version — bump to the next patch if you need to redeploy with a fix.

### What `pnpm deploy:cdn` does NOT do

- Tag the commit in git. You should do that manually if you want one (`git tag vX.Y.Z && git push origin vX.Y.Z`).
- Update the Shopify theme block. That's a separate step (§4).
- Roll back on smoke-test failure. See `widget-sdk-rollback.md`.

### Smoke test after deploy

```bash
# Check the served file has the new ETag
curl -sI https://widgets.automatos.app/v0/widget.global.js | grep -i "etag\|last-modified"
# last-modified should match your deploy time

# Or inspect with DevTools on any storefront preview — Network tab → widget.global.js
```

### Rollback

See `widget-sdk-rollback.md` for the canonical procedure. Quick version:

```bash
# Restore previous immutable version into the v0/ alias
GOOD=vX.Y.W   # last known good
aws s3 cp s3://automatos-widget-sdk/$GOOD/widget.global.js \
          s3://automatos-widget-sdk/v0/widget.global.js \
  --cache-control "public, max-age=3600" \
  --content-type "application/javascript" \
  --metadata-directive REPLACE
aws cloudfront create-invalidation \
  --distribution-id "$AWS_SDK_DEPLOY_DISTRIBUTION_ID" \
  --paths "/v0/*"
```

---

## Step 4 — Shopify theme extension

**Branch:** any branch where the Liquid change lives (often the `automatos-shopify` repo's main, or a feature branch).
**Files typically touched:** `extensions/automatos-theme/blocks/*.liquid`, `extensions/automatos-theme/shopify.extension.toml`.

### Deploy

```bash
cd ~/Development/Automatos-AI-Platform/automatos-shopify

# Switch to the merchant's per-client toml (NOT the master toml)
shopify app config use shopify.app.<merchant>.toml

# Deploy + release
shopify app deploy --config=<merchant>
# Creates a new app version draft (e.g. automatos-ai-4).
```

Then in the merchant's Partner Dev Dashboard:
- Apps → automatos-ai → **Versions** tab
- Find the new version → click **Release version**

After release, installed merchants receive the update within ~30 seconds.

### Verify it's actually rendering

Each merchant who already has the embed enabled in a theme may need to **rebind** their theme to the new version:

1. Merchant admin → **Online Store → Themes → [target theme] → Customize**
2. **App embeds** sidebar → Automatos embed
3. **Toggle OFF → Save → Toggle ON → Save**

This re-binds the theme to the active app version.

Diagnostic in DevTools:
```
Right-click chat widget → Inspect → find <div data-automatos-widget="chat">

If you see new attrs (data-page-type, data-product-handle, etc.) → new version live.
If only the old attrs (data-api-key, data-position, data-theme, ...) → theme is on an old version, rebind it.
```

### For multi-merchant rollout

Same `shopify app config use ...` + `shopify app deploy ...` pattern, repeated per merchant. Theme extension uploads are scoped to each merchant's Partner app — they don't share.

---

## End-to-end verification after a full release

Run these in order on a test merchant's preview URL:

1. **DevTools Network → `widget.global.js`** → 200 with fresh ETag (means SDK CDN deploy landed).
2. **DevTools Network → `/api/widgets/config`** → 200 (means SDK is the new build that calls this endpoint).
3. **DevTools Elements → chat widget `<div>` attrs** → new attrs present (means theme extension is on the new version).
4. **Feature-specific check** → e.g. for PRD-007, tick the proactive checkbox in theme customizer → wait 20s on a product page → popup appears.

If any check fails, you can immediately identify which layer is the bottleneck.

---

## Common pitfalls

| Pitfall | How to recognise | Fix |
|---|---|---|
| Theme deployed but app version not Released | New attrs absent in DevTools Elements; Dev Dashboard shows version as "Draft" | Release the version in the Dev Dashboard |
| Theme released but the merchant's theme still on old version | App version says Released but embed shows old behaviour | Toggle the embed OFF → Save → ON → Save in theme customizer |
| `pnpm deploy:cdn` complains about existing version | "ERROR: vX.Y.Z already published" | Bump to the next patch — immutable versions never overwrite |
| SDK deployed but DevTools shows old ETag | CloudFront edge cache | Wait 60s for invalidation to propagate, or hard-refresh storefront (CMD+Shift+R) |
| Orchestrator returns 404 on new endpoint | Railway hasn't picked up the new build | Check railway.app build log — if successful, wait 30s for the service to restart |
| Tests pass locally but fail in worktree | Missing `.env` (gitignored) — DB credential system can't initialise | Run tests in the live repo dir, not a fresh worktree |
| New widget feature dormant despite all layers deployed | Defaults usually start OFF — merchant must opt-in | Check the theme block's feature toggle (or workspace settings for advanced merchants) |

---

## Cross-references

- AWS infra setup: `widget-sdk-aws-setup.md`
- SDK rollback: `widget-sdk-rollback.md`
- Merchant onboarding (per-client install): `client-onboarding.md`
- Shopify install gotchas: `../SHOPIFY/SETUP-GUIDE.md`
- Embedding the widget on non-Shopify sites: `automatos-widget-sdk/docs/EMBEDDING.md`
- PRDs: `../PRDS/`
