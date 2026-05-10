# Client Onboarding — Runbook

**Purpose:** step-by-step playbook for connecting a new merchant store to Automatos. Use this for both internal PoC dev stores and live merchant rollouts.

**Audience:** the engineer or ops person doing the onboarding.

**Time estimate:** 15–25 min for a clean run, 45–60 min if Composio's auth dance hits a snag.

---

## 0. Before you start

Confirm the prerequisites are in place. If any of these are missing, fix that first and come back here.

- [ ] Partner app `automatos-ai` is published / in dev preview, with the **34-scope list** from `shopify.app.toml` saved + a current release in the Partner Dashboard
- [ ] **Use legacy install flow** is checked on the Partner app (gotcha #4 in `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md`)
- [ ] Both Composio redirect URLs in the Partner app: `https://backend.composio.dev/api/v3/toolkits/auth/callback` and `https://backend.composio.dev/api/v1/auth-apps/add`
- [ ] Composio shared auth config `ac_iOROGtpG6qVR` is alive (has 34 scopes — check Composio dashboard)
- [ ] `https://api.automatos.app/health` returns 200
- [ ] You have the merchant's dev or live store handle (e.g. `innobuilduk.myshopify.com`) and Partner Dashboard access to install on it

---

## 1. Install the Partner app on the merchant's store

Two paths — pick one:

### 1a. Partner Dashboard test install (PoC / dev stores)
1. Shopify Partner Dashboard → Apps → `automatos-ai` → **Test on development store**
2. Pick the merchant's dev store from the dropdown → Install
3. You'll be redirected through Shopify OAuth → scope approval screen → click **Install app**
4. Shopify hands off to `auth.callback.tsx` on the deployed app (currently `https://ui.automatos.app/auth/callback?...`)

### 1b. Direct install URL (live merchants without Partner test access)
- Generate an install URL: `https://<merchant-store>.myshopify.com/admin/oauth/install_custom_app?client_id=<SHOPIFY_API_KEY>` — share with the merchant, they click and approve.

**Either path lands on `auth.callback.tsx`** which performs:
- `POST /api/shopify/provision` → creates workspace, clones the 9 marketplace agents, mints a public widget API key
- `POST /api/shopify/connect` → stores the merchant's Shopify access token

---

## 2. Capture the workspace IDs

Right after install, the orchestrator logs the provision result. Pull the line that looks like:

```
[automatos] provisioned <shop>.myshopify.com: workspace=<UUID> agents=9 is_new=true key_prefix=ak_pub_xxxx...
```

Where to read this:
- **Production:** orchestrator logs (`api.automatos.app` → wherever logs ship — check `automatos-ai/docs/RUNBOOKS/`)
- **Local dev (`shopify app dev`):** the dev tunnel terminal output

Record:
- `workspace.public_id` (UUID) — this is what Composio will use as `entity_id`
- The first 12 chars of `api_key` (full key shown ONCE; can be regenerated on re-install)

If provisioning failed (look for `[automatos] provisioning failed for ...` in logs), DO NOT proceed — fix the orchestrator side first. The merchant CAN still get into the embedded app, but agents and Composio won't work.

---

## 3. Wire up Composio for this merchant

Update `.env.local` at the repo root:

```bash
COMPOSIO_API_KEY=ak_...                  # already set (shared)
SHOPIFY_DEV_STORE=<merchant-subdomain>   # e.g. "innobuilduk" — no .myshopify.com
COMPOSIO_ENTITY_ID=<workspace.public_id> # UUID from step 2
```

Then run:

```bash
nvm use
node --env-file=.env.local scripts/composio-resume.mjs
```

The script will:
1. Initiate a Composio connection against the shared auth config `ac_iOROGtpG6qVR`
2. Print an authorize URL — open it, click **Install app** on Shopify
3. Poll until ACTIVE (10 min window)
4. Smoke-test with `SHOPIFY_GET_SHOP_DETAILS` and `SHOPIFY_COUNT_PRODUCTS`
5. Print the final `connected_account` ID

Record the `connected_account_id` (`ca_*`) against the merchant — both in Composio dashboard and in `docs/SHOPIFY/CLIENTS.md`.

If you hit errors here, the troubleshooting matrix lives at the bottom of `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md`.

---

## 4. Verify storefront widgets load

The widget JS is served from `widgets.automatos.app/v0/`. The theme extension references it from `extensions/automatos-theme/blocks/*.liquid`.

For PoC merchants, do this on an **unpublished theme copy**:

1. Merchant's admin → Online Store → Themes → duplicate the published theme → preview the duplicate
2. In the duplicated theme, **Customize** → drop the Automatos chat block onto a page (homepage or product page)
3. Open browser devtools on the storefront preview → Network tab → confirm:
   - `widgets.automatos.app/v0/widget.js` returns 200
   - Widget initiation POST to orchestrator returns a JWT
4. Send a test message in the widget. Confirm it streams back a response.

**Do NOT publish the modified theme until the merchant explicitly approves.**

---

## 5. Sign-off + handover

Before declaring the merchant onboarded:

- [ ] Provision logged successfully, workspace IDs recorded
- [ ] Composio `connected_account` is ACTIVE, smoke tests passed
- [ ] Storefront widget loads + responds on unpublished theme
- [ ] Embedded admin app reachable at `https://<merchant>.myshopify.com/admin/apps/automatos-ai`
- [ ] `docs/SHOPIFY/CLIENTS.md` updated with the new merchant row
- [ ] Merchant told they need to publish the theme themselves when ready

---

## Common pitfalls (in order of likelihood)

1. **Provision fails with 422** — `external_id` or `name` missing. Check `auth.callback.tsx` is reading shop metadata correctly.
2. **Composio stuck at `INITIATED`** — merchant didn't click Install on the authorize URL, or clicked but Shopify didn't redirect (check Partner app redirect URLs are both v1 and v3).
3. **Smoke test fails with `Toolkit version not specified`** — the script pins `20260414_00`. If that's stale, check `https://docs.composio.dev/toolkits/shopify` for the current version.
4. **Smoke test fails with tool-not-found** — toolkit slugs change occasionally. The script uses `SHOPIFY_GET_SHOP_DETAILS` + `SHOPIFY_COUNT_PRODUCTS`. If those move, use `getRawComposioTools({ toolkits: ["shopify"], limit: 400 })` to find the new names.
5. **Widget loads but JWT handshake fails** — check `workspace.api_key` was actually used in the theme block. The theme app block reads it from a metafield/settings; confirm it's populated.

---

## Reference

- Architecture: `docs/ARCHITECTURE.md` (Flow I labels each step)
- Composio details + gotchas: `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md`
- Per-merchant registry: `docs/SHOPIFY/CLIENTS.md`
- Orchestrator API contract: `automatos-ai/orchestrator/api/shopify.py`

---

## Appendix A — Live merchant install with guardrails (e.g. INBUILD UK)

**Use this when:** the merchant insists on testing against their real live store data and a fresh dev store + Shopify test data isn't acceptable. This still avoids touching shopper-facing surfaces.

**Prerequisites in addition to §0:**
- [ ] Merchant explicitly authorises the install — written or recorded.
- [ ] `ui.automatos.app` deploys the current contract refactor (verify by curling `https://api.automatos.app/api/shopify/provision` returns 422, not 404, and the deployed Shopify-app commit matches `git rev-parse HEAD`).
- [ ] You have access to the merchant's Online Store admin (or they're available to follow your steps live).

### A.1 Identify or create the unpublished theme to use

Reasoning: app embeds are per-theme opt-in (the merchant toggles them on in **Theme settings → App embeds**), so installing Automatos does not auto-render widgets anywhere. The widget only renders in themes where the embed is explicitly toggled ON. To keep the chat widget off the live storefront we enable it only in an unpublished theme.

**Preferred:** the merchant already has an unpublished testing/staging theme (e.g. "AI Testing", "Staging"). Use that. No duplication needed.

**Fallback:** if no unpublished theme exists, duplicate the published theme:
1. Merchant admin → **Online Store → Themes** → next to the published theme, click **⋯ → Duplicate**
2. Rename the duplicate to something obvious — e.g. `Automatos PoC — DO NOT PUBLISH`

Either way:
- Confirm the chosen theme is **unpublished** (the published theme remains the live one)
- Note the theme's **Preview** URL — that's the only place we'll demo widgets
- Tell the merchant explicitly: *"Treat this theme as preview-only — do NOT click Publish during the PoC."*

### A.2 Install Automatos on the live store

Standard install path (Partner Dashboard test install, or production install link). When OAuth completes:
- `auth.callback.tsx` runs against the deployed `ui.automatos.app` (must be the refactored version)
- Provision succeeds → workspace created against `innobuilduk.myshopify.com`
- Access token stored via `/api/shopify/connect`

**Do NOT use `shopify app dev` for the live install** — that creates a temporary tunnel that dies. The merchant's workspace must be against the persistent production app.

### A.3 Capture provision result + Composio wire-up

Same as §2 and §3 of the main runbook. Record:
- `workspace.public_id` (from orchestrator logs)
- `api_key` first 12 chars
- After `composio-resume.mjs`: `connected_account` ID

### A.4 Read-only-only Composio guardrail

For PoC, **do not execute any `SHOPIFY_*_CREATE`, `_UPDATE`, or `_DELETE` tool**, even though the OAuth grant includes write scopes. Confirm what tools agents can call by:

```bash
# from automatos-ai repo
grep -rE "(SHOPIFY_[A-Z_]+_)(CREATE|UPDATE|DELETE)" orchestrator/services/agents/
```

If any agents have write tools assigned, either disable those tool assignments in the agent config, or pause the corresponding agent for the duration of the PoC. Track in `docs/SHOPIFY/CLIENTS.md` notes column.

### A.5 Enable widgets — UNPUBLISHED THEME ONLY

In the merchant's admin → **Online Store → Themes → [the unpublished theme from A.1]** → **Customize**:

1. **Theme settings → App embeds** — find "Automatos AI Widgets". Toggle ON only the chat widget. **Verify the embed remains OFF in the published theme.** App embeds are per-theme; toggling here does NOT affect any other theme.
2. Add the public API key (`workspace.api_key`) and the agent ID to the chat block settings.
3. Drop section widgets (product Q&A, blog, review summary) onto specific page templates inside the unpublished theme as desired.
4. Save. **Do NOT click Publish.**

### A.6 Verify on preview URL + live unchanged

1. Open the unpublished theme's Preview URL in a fresh browser window
2. Open devtools Network tab — confirm `widgets.automatos.app/v0/widget.global.js` returns 200
3. Confirm widget mounts (Shadow DOM root visible in Elements tab under `<body>`)
4. Send a test message in chat — confirm response streams back from orchestrator
5. **Open the live published storefront** in another window — confirm NO `widget.global.js` request fires and NO widget element renders. Take a screenshot for the record.

### A.7 Sign-off + handover

- [ ] Demo recorded or screenshared with merchant on the preview URL
- [ ] Merchant explicitly approves the next step (publish, or further iteration on duplicate, or uninstall)
- [ ] `docs/SHOPIFY/CLIENTS.md` row added with status `poc-live-guardrailed`
- [ ] Merchant told they own the publish decision; you don't publish for them

### A.8 Rollback (if anything goes sideways)

The merchant uninstalls Automatos via their app list. That fires `app/uninstalled` webhook → `automatosClient.onShopUninstall` → orchestrator soft-deletes workspace. The unpublished theme (whether existing or duplicated) stays untouched, but the Automatos embed inside it goes dormant once the app is uninstalled (no public API key validates → widget fails closed). Composio `connected_account` stays until manually revoked in the Composio dashboard.

No data is destroyed on the merchant side. The published theme was never touched.
