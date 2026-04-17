# Automatos ↔ Shopify — Status

**Snapshot:** 2026-04-16, end-of-evening checkpoint
**Next review:** morning 2026-04-17

---

## What shipped tonight

### PRD-002 — Scope reconciliation (COMPLETE)
- `shopify.app.toml` now carries the full 34-scope list matching `scripts/composio-setup.mjs` `FULL_SCOPES`.
- `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md` Step 1a rewritten to point at `shopify.app.toml` as the canonical source; scope list no longer inlined into the doc (no drift risk).
- **Nothing deployed.** `shopify app deploy` NOT run. Do that tomorrow after you confirm no merchant-facing impact.

### PRD-003 — CDN code artifacts (COMPLETE pre-AWS)
Created (all safe — no infra touched):
- `docs/RUNBOOKS/widget-sdk-aws-setup.md` — ordered AWS setup checklist (bucket, ACM, CloudFront, Route 53, IAM user, OIDC migration path, observability, costs).
- `docs/RUNBOOKS/widget-sdk-rollback.md` — severity-tiered rollback procedure with copy-paste AWS CLI commands. Kill-switch IIFE included.
- `docs/RUNBOOKS/widget-sdk-deploy-workflow.yml.template` — GitHub Actions workflow ready to drop into `automatos-widget-sdk/.github/workflows/deploy.yml`. Handles versioned + stable + beta channels, smoke tests with retry, concurrency guard.
- `infra/iam/widget-sdk-deploy-policy.json` — least-privilege IAM policy (scoped to one bucket + one distribution). Placeholders for `ACCOUNT_ID` + `DISTRIBUTION_ID`.

**NOT touched:** the theme extension Liquid files. That cutover requires the CDN to be live first — don't pre-stage a URL that doesn't resolve.

### PRD-004 — Composio token-import spike (PARTIAL)
Ran `scripts/composio-surface-probe.mjs` against the live SDK. Key findings:
- **`composio.connectedAccounts.create()` does NOT exist.** Methods available: `delete, disable, enable, get, initiate, link, list, refresh, update, updateStatus, waitForConnection`. The original PRD-004 "happy path" assumption is invalid as written.
- `.link()` and `.update()` are candidates — tomorrow's full spike should probe those.
- Existing auth config `ac_iOROGtpG6qVR` has exactly the 34-scope list now in `shopify.app.toml` — **zero drift** between app config and Composio config.

PRD-004 has been updated with a new "Spike result (2026-04-16, partial)" section capturing this. The `scripts/composio-token-import-spike.mjs` is written and ready to run once you supply `SHOPIFY_ACCESS_TOKEN` + `SHOPIFY_SHOP_DOMAIN` in `.env.local`.

### PRD-006 — Widget auth model design (DEEPENED)
Added "Design appendix (locked 2026-04-16)" to the PRD covering:
- SQL migration skeleton for `api_keys` table — not applied, needs type-check against the real `workspaces(id)` column type before running.
- Middleware pseudocode for `public_key_auth`.
- Tier thresholds table (trial/starter/growth/enterprise) — locked for v1.
- JWT claim structure — locked.
- CORS enforcement points — defence-in-depth across preflight, session init, WebSocket upgrade, tool-execute.

---

## Morning plan — in priority order

### 1. Review + commit tonight's work
```bash
cd /Users/gkavanagh/Development/Automatos-AI-Platform/automatos-shopify
git status
git diff
```

Look at:
- `shopify.app.toml` scope line swap (safest change)
- `docs/PRDS/PRD-004-*` — spike-result addendum
- `docs/PRDS/PRD-006-*` — design appendix
- `docs/RUNBOOKS/` — three new runbooks
- `infra/iam/widget-sdk-deploy-policy.json`
- `scripts/composio-token-import-spike.mjs`
- `scripts/composio-surface-probe.mjs`

If it all looks sane, commit as one PR or branch so you can review incrementally.

### 2. PRD-002 deploy (15 min)
- `shopify app config push` (re-push the TOML so Partner Dashboard sees the new scopes).
- In Partner Dashboard, create a new release so the scope change takes effect.
- **Existing merchants:** new scopes are additive (old ones stay), but Shopify may require re-auth on each merchant to actually *grant* the new scopes. Not destructive; old scopes keep working. Confirm on `1lovefragrance` first.
- After deploy, the `composio-setup.mjs` auth config is already in sync (verified tonight) — no re-run needed.

### 3. Finish PRD-004 spike (30 min)
```bash
# Extract a test store's access token (from any dev store install) into .env.local:
echo "SHOPIFY_ACCESS_TOKEN=shpua_..." >> .env.local
echo "SHOPIFY_SHOP_DOMAIN=<store>.myshopify.com" >> .env.local

# Update the spike script with attempts for .link() and .update()  (TODO: add these before running)
# Then:
node --env-file=.env.local scripts/composio-token-import-spike.mjs
```

Before running, extend `scripts/composio-token-import-spike.mjs` with two more attempts:
```js
// Attempt D: connectedAccounts.link()
composio.connectedAccounts.link({
  userId: env.COMPOSIO_ENTITY_ID,
  authConfigId,
  credentials: { access_token, shop },
});

// Attempt E: initiate to get placeholder, then update()
const placeholder = await composio.connectedAccounts.initiate(...);
await composio.connectedAccounts.update(placeholder.id, {
  credentials: { access_token, shop },
  status: "ACTIVE",
});
```

Outcome determines PRD-004 critical path:
- **If `.link()` works** → ~50 LOC on orchestrator, ship PRD-004 this week.
- **If `.update()` works** → ~80 LOC (two-step).
- **If neither** → silent-OAuth fallback, ~150 LOC + 1 day.

### 4. Product decision: workspace provisioning strategy
Blocks PRD-004 implementation. From the INDEX open questions:
- **Auto-provision with magic link** (recommended default)
- Link-existing (handles both cases, one extra click)
- Pre-register required (high friction)

Make the call before writing code. This cannot be deferred past the spike.

### 5. If time — start PRD-003 AWS setup
Follow `docs/RUNBOOKS/widget-sdk-aws-setup.md` in order. Step 1–6 can happen without touching merchant traffic (bucket + distribution + placeholder seed). Step 7 (GitHub Actions deploy) needs the `automatos-widget-sdk` repo updated with the workflow file. Step 8 (Liquid cutover) is the only merchant-facing change — save that for last, test on `1lovefragrance` only.

---

## What I deliberately did NOT touch

- `extensions/automatos-theme/blocks/*.liquid` — CDN URL swap is a merchant-facing change; requires CDN to be live first.
- Orchestrator code — no auth.callback.tsx edits, no new endpoints, no migrations applied.
- Any Shopify deploy, theme push, or extension release.
- Secret rotation or IAM user creation.
- The Composio dashboard (no auth configs created or modified beyond introspection).
- PRD-005 widget builds — would have taken too long to do properly, defer until CDN is live (the whole point of 005 is that widgets ship independently).
- `MEMORY.md` or auto-memory — not session-relevant to the code work.

---

## Known sharp edges to be aware of

1. **`ac_wwcaUIBEt9bX`** is a stale API_KEY auth config in Composio (2 connections, 4 scopes) — separate from the active `ac_iOROGtpG6qVR`. Leave it alone unless you want to clean up. Don't delete without checking the 2 connections aren't production.
2. **The `shopify app deploy` scope downgrade risk** still exists for the Partner app itself — but with the toml now matching FULL_SCOPES, a deploy should NOT trigger a downgrade cascade. Verify by running `shopify app config validate` before pushing.
3. **The spike script will create a real connected_account** on your Composio workspace if it succeeds. Clean up in the Composio dashboard after testing to keep your account tidy.
4. **The GH Actions workflow template** is a *template* — it lives in `docs/RUNBOOKS/` with a `.template` suffix so it doesn't accidentally get discovered. Copy it to `automatos-widget-sdk/.github/workflows/deploy.yml` when you're ready.

---

## Open product questions still blocking work

1. **Workspace provisioning on App Store install** — blocks PRD-004 implementation. (See morning plan #4.)
2. **`cart` widget scope** — what does it actually do? Drop from route list or define. Blocks PRD-005 planning.
3. **Admin widget rendering strategy** — Option A (native Polaris) vs Option B (shared SDK with Polaris wrapper). Recommended A; needs your sign-off. Blocks PRD-005 for `daily-brief` + `inventory`.

---

## Files touched tonight

### Created
- `docs/RUNBOOKS/widget-sdk-aws-setup.md`
- `docs/RUNBOOKS/widget-sdk-rollback.md`
- `docs/RUNBOOKS/widget-sdk-deploy-workflow.yml.template`
- `docs/STATUS.md` (this file)
- `infra/iam/widget-sdk-deploy-policy.json`
- `scripts/composio-surface-probe.mjs`
- `scripts/composio-token-import-spike.mjs`

### Modified
- `shopify.app.toml` — scope line expanded 9 → 34 + comment pointing at FULL_SCOPES
- `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md` — Step 1a rewritten to reference TOML as canonical
- `docs/PRDS/PRD-004-UNIFIED-INSTALL-FLOW.md` — spike result section added above prerequisite spike
- `docs/PRDS/PRD-006-WIDGET-AUTH-MODEL.md` — design appendix added (SQL, middleware, tiers, JWT, CORS)

### Untouched (deliberately)
- Everything in `extensions/`, `app/routes/`, orchestrator code, `prisma/`, `.env.local` (except noted additions suggested for tomorrow).

---

## Quick `git diff` sanity check commands

```bash
# See everything changed tonight
git status

# Check the scope swap is correct
diff <(grep -oE 'read_[a-z_]+|write_[a-z_]+' shopify.app.toml | sort -u) \
     <(grep -oE '"(read|write)_[a-z_]+"' scripts/composio-setup.mjs | tr -d '"' | sort -u)
# Expect zero output — both lists identical.

# Confirm no files outside expected paths were touched
git status --short | awk '{print $2}' | grep -v -E '^(docs/|infra/|scripts/|shopify.app.toml)' || echo "clean — no unexpected paths"
```
