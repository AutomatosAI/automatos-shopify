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

> **First-time installer?** Read `docs/SHOPIFY/SETUP-GUIDE.md § "Per-client install workflow"` first — it covers the `shopify app config link` → `shopify app deploy` → install-via-Dev-Dashboard flow, plus the gotchas (per-client tomls, scopes-only auto-sync, placeholder application_url). ~5 min read.

The working pattern is: each merchant has their own copy of the `automatos-ai` Partner app inside their own Dev Dashboard. You link, deploy, install — same workflow regardless of which merchant.

```bash
# Link this repo to the merchant's Dev Dashboard app
shopify app config link
# - Pick org → merchant's Dev Dashboard org (e.g. "INBUILD UK")
# - Pick app → existing automatos-ai if there is one, otherwise create new
# - Pick config name → e.g. "automatos-ai" → writes shopify.app.automatos-ai.toml

# Hand-copy from shopify.app.toml into the new toml:
#   - [webhooks] block + [[webhooks.subscriptions]]
#   - [auth] redirect_urls (only if Composio is in scope)
#   - application_url (deployed server URL, or leave placeholder for widget-only PoC)

# Deploy to merchant's app
shopify app deploy

# Install via merchant's Dev Dashboard
# dev.shopify.com/dashboard/<org-id>/apps/automatos-ai → Install app → pick store
```

After install, the app appears under Apps in the merchant's admin and the theme extension is available in their theme customizer. **No widget renders anywhere yet** — embeds are OFF by default in every theme.

---

## 2. Mint workspace + public widget API key

The install does **not** auto-provision an Automatos workspace. You mint the workspace + key out-of-band:

```bash
curl -X POST https://api.automatos.app/api/shopify/provision \
  -H "Content-Type: application/json" \
  -d '{
    "source": "shopify",
    "external_id": "<store>.myshopify.com",
    "name": "<Merchant Name>",
    "metadata": {"shopify_domain": "<store>.myshopify.com"}
  }'
```

Returns `{id, public_id, name, api_key, agents_installed, is_new}`. Save:
- `workspace.public_id` (UUID) — used as `COMPOSIO_ENTITY_ID` if wiring up Composio
- `api_key` (full string, `ak_pub_...`) — paste into theme widget settings

The endpoint is idempotent on `shopify_domain`. If you re-run it, the same workspace is returned (but the `api_key` is regenerated — the previous one stops working, so only re-run when intentionally rotating the key).

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
   - `GET /api/widgets/config` returns the workspace's `widget_proactive` block (200, body contains `config.widget_proactive`)
4. Send a test message in the widget. Confirm it streams back a response.

**Do NOT publish the modified theme until the merchant explicitly approves.**

---

## 4a. (Optional) Enable PRD-007 proactive engagement

Skip this section for v1 PoCs unless the merchant has signed off on the brand-voice opener for their workspace. Off by default to prevent surprise behaviour.

**The merchant does this themselves in their theme customizer** — no backend access required, no SQL, no workspace ID lookup. Walk them through it (or do it for them on the preview theme):

1. **Online Store → Themes → [their theme] → Customize**
2. **App embeds → Automatos Support Chat**
3. Scroll to **Proactive engagement (beta)**
4. Tick **Enable proactive popups**
5. (Optional) adjust **Popup delay (seconds)** — default 20
6. (Optional) edit **Popup message** — default "Need a hand finding the right product?"
7. **Save**

Verify on the preview URL:
- Stay 20s on a product page → corner-bubble popup with contextual opener.
- Dismiss → no re-pop this session.
- Navigate to a different product → re-arms (different slot).
- Live published theme: confirm NO popup fires (embed off there).

For finer tuning (popup_style, page_types beyond product, frequency_cap), use `workspace.settings.widget_proactive` directly — full schema in `docs/SHOPIFY/SETUP-GUIDE.md § "Proactive engagement activation"`.

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

1. **`shopify app config link` picks the wrong org** — re-run with `--reset` and pick carefully; the org must own the merchant's store.
2. **`shopify app deploy` fails with missing webhooks** — `shopify app config link` only auto-syncs scopes. Hand-copy `[webhooks]` and `[[webhooks.subscriptions]]` from `shopify.app.toml` to the per-client toml.
3. **Cross-org install error** ("not a dev store associated with the Partner organization X") — the existing app is in a different org from the merchant. Don't try to install across orgs; instead `shopify app config link` to the merchant's own org and create a per-client app there.
4. **Provision returns 422** — `external_id` or `name` missing in the curl body. Recheck the JSON.
5. **Composio stuck at `INITIATED`** — merchant didn't click Install on the authorize URL, or clicked but Shopify didn't redirect (check Partner app redirect URLs are both v1 and v3 in the per-client toml's `[auth]` block).
6. **Composio smoke test fails with `Toolkit version not specified`** — the script pins `20260414_00`. If that's stale, check `https://docs.composio.dev/toolkits/shopify` for the current version.
7. **Widget loads but JWT handshake fails** — confirm `workspace.api_key` was pasted into the theme block settings (Theme customizer → App embeds → Automatos AI Widgets → API Key field).

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
- [ ] You have access to the merchant's Dev Dashboard (`dev.shopify.com/dashboard/<their-org-id>`) so you can run `shopify app config link` against their org.
- [ ] You have access to the merchant's Online Store admin (or they're available to follow your steps live) for the post-install widget configuration.
- [ ] Orchestrator endpoints alive — verify by curling `https://api.automatos.app/api/shopify/provision` returns 422, not 404.

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

Use the per-client deploy flow from §1 of this runbook (full detail in `docs/SHOPIFY/SETUP-GUIDE.md § "Per-client install workflow"`):
1. `shopify app config link` → pick the merchant's org → use existing `automatos-ai` app in their Dev Dashboard or create one
2. Hand-copy webhooks + (optional) Composio redirect URLs from master `shopify.app.toml` into the per-client toml
3. `shopify app deploy` → pushes scopes + theme extension to the merchant's app
4. Merchant Dev Dashboard → Apps → `automatos-ai` → **Install app** → pick the live store → approve scopes

**Do NOT use `shopify app dev`** for the live install — that's for local development of this repo, not production installs.

### A.3 Mint workspace + Composio wire-up

Same as §2 and §3 of the main runbook. Record:
- `workspace.public_id` (returned by the provision curl)
- `api_key` first 12 chars (stored once, save the full key for the widget)
- After `composio-resume.mjs`: `connected_account` ID (only if Composio is in scope for this client)

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
