# Composio ↔ Shopify Connection Setup

**Purpose:** Connect a merchant's Shopify store to Composio so Automatos agents can call the ~394 Shopify Admin API tools on their behalf.

**Audience:** Engineer or ops person onboarding a new merchant / test store.

**Outcome:** An ACTIVE Composio `connected_account` tied to the merchant's Shopify store, with 30+ scopes granted. Agents can immediately execute any of 394 Shopify tools against that store.

---

## Architecture in one paragraph

**One Composio auth config per Shopify Partner app `client_id`** → each merchant gets their own **connected account** via OAuth → Automatos agents call Composio tools referencing the connected account's entity ID → Composio executes against the merchant's store using the stored per-merchant access token.

> ⚠️ **Per-client app model (post-2026-05).** Originally we ran one shared `client_id` for all merchants. After running into Shopify's cross-org install constraints, the working pattern shifted to **one Partner app per merchant org** (each app gets created inside the merchant's own Dev Dashboard via `shopify app config link`). That means each merchant's app has its own `client_id`, which means **each merchant needs its own Composio auth config** — they can't share `ac_iOROGtpG6qVR`. See `docs/SHOPIFY/SETUP-GUIDE.md § "Per-client install workflow"` for the install pattern this implies.

You do Steps 1–2 **once per merchant org** (whenever a new Partner app is created in their Dev Dashboard). You do Steps 3–5 **once per merchant store** within that org.

---

## Prerequisites (one-time)

- A Shopify Partner account with a Partner app named `automatos-ai` (or similar). Client ID + Client Secret required.
- A Composio account + API key (starts with `ak_`).
- Node.js 20 installed.
- The `@composio/core` SDK (`npm install @composio/core`).

---

## Step 1 — Configure the Shopify Partner App (one-time)

Go to Shopify Partner Dashboard → Apps → your app → **Configuration**.

### 1a. Access → Scopes

**Canonical source:** `shopify.app.toml` at the repo root. The `[access_scopes].scopes` line there is the single source of truth for what scopes the Automatos Shopify app requests. The same list must also appear in `FULL_SCOPES` inside `scripts/composio-setup.mjs` — keep the two in lockstep. If they drift, Composio-issued tokens end up with scopes the Partner app doesn't, and agent tool calls 403.

**What to paste into the Partner Dashboard Scopes field:** copy the value of `[access_scopes].scopes` from `shopify.app.toml` verbatim (one comma-separated line). As of this writing, that is the 34-scope list covering products, orders, customers, inventory, content, discounts, price rules, fulfillments, gift cards, draft orders, shipping, analytics, reports, marketing events, themes, script tags, checkouts, product listings, and locations.

**Rule of thumb:** never paste scopes from this doc — always pull from `shopify.app.toml`. This doc can go stale; the toml is under code review.

### 1b. Access → Use legacy install flow

> ⚠️ **Updated 2026-04-23.** Originally this had to be CHECKED for Composio compatibility. We removed it (commit `8097891 fix(shopify): unblock app deploy`) because it's incompatible with app-specific webhooks (`[[webhooks.subscriptions]]`). Composio's OAuth callback now works without it — leave **UNCHECKED**, and ensure all webhook subscriptions are app-scoped, not shop-scoped.

### 1c. Access → Redirect URLs

Paste **both** URLs, comma-separated, in this exact format:

```
https://backend.composio.dev/api/v3/toolkits/auth/callback,https://backend.composio.dev/api/v1/auth-apps/add
```

**Both are required.** Composio uses the v1 URL as its actual OAuth callback; v3 is kept for any future Composio migrations and matches their public docs.

### 1d. URLs → App URL

`https://ui.automatos.app` (or whatever your dashboard URL is). Required even for the Composio-only flow.

### 1e. Save + Release

1. Scroll down, click **Save**.
2. Create a **new release** (Versions tab → Release).
3. Saves only take effect after the release is published.

---

## Step 2 — Create the Composio Auth Config (per merchant org, programmatic)

**Do NOT use the Composio dashboard UI.** The UI only exposes 4 Shopify scopes (products + orders read/write). Programmatic creation accepts the full scope list.

> ⚠️ **One auth config per merchant `client_id`.** Each merchant's Partner app (created inside their own Dev Dashboard) has its own `client_id`. The Composio auth config binds OAuth credentials to one specific `client_id`, so you create one auth config per merchant. **Do not reuse `ac_iOROGtpG6qVR` across merchants** — that one is bound to the original PoC app and won't authorise for other merchants' apps.

### 2a. Update `.env.local` for the merchant you're onboarding

Each run targets one merchant. Update `.env.local` with that merchant's Partner app credentials:

```bash
COMPOSIO_API_KEY=ak_...                          # shared across all merchants
SHOPIFY_CLIENT_ID=<merchant Partner app client_id>     # per-merchant
SHOPIFY_CLIENT_SECRET=<merchant Partner app client_secret>  # per-merchant
SHOPIFY_DEV_STORE=<merchant store handle>        # per-merchant, e.g. "innobuilduk"
COMPOSIO_ENTITY_ID=<merchant workspace public_id>      # per-merchant
```

The merchant's `client_id` and `client_secret` come from their Dev Dashboard → Apps → automatos-ai → Settings page.

(`.env.local` is already in `.gitignore`.)

### 2b. Run the auth-config creation script

Script: `scripts/composio-setup.mjs` (already in the repo).

```bash
nvm use 20
node --env-file=.env.local scripts/composio-setup.mjs
```

The script will:
1. Introspect the Shopify OAuth2 schema (confirms `scopes` is accepted).
2. Create a custom auth config with `type: "use_custom_auth"`, full scope list, the merchant's OAuth credentials.
3. Print the new `auth_config_id` (format: `ac_...`).

**Record the `auth_config_id` against the merchant** in `docs/SHOPIFY/CLIENTS.md`.

Example output:
```
Auth config: {
  "id": "ac_<unique-per-merchant>",
  "authScheme": "OAUTH2",
  "isComposioManaged": false,
  "toolkit": "shopify"
}
```

### 2c. Wire the auth_config_id into the orchestrator (or pass via env)

The per-merchant `auth_config_id` is needed by `scripts/composio-resume.mjs` when initiating the connection. The script reads `AUTH_CONFIG_ID` from `.env.local` — append it after step 2b:

```bash
echo "AUTH_CONFIG_ID=ac_<merchant-auth-config-id>" >> .env.local
```

(Older repo state hardcoded `ac_iOROGtpG6qVR` in the script; the script now reads from env so per-merchant onboarding doesn't require a code edit.)

---

## Step 3 — Connect a Merchant Store (per-merchant)

For every new merchant, do this:

### 3a. Add merchant-specific env vars

Append to `.env.local`:
```bash
SHOPIFY_DEV_STORE=<merchant subdomain>   # e.g. "1lovefragrance" (no .myshopify.com)
COMPOSIO_ENTITY_ID=<merchant's Automatos workspace public_id>
```

### 3b. Run the per-merchant script

Script: `scripts/composio-resume.mjs`

```bash
node --env-file=.env.local scripts/composio-resume.mjs
```

It will:
1. Initiate a Composio connection for this entity against the shared auth config.
2. Print an authorize URL like `https://backend.composio.dev/api/v3/s/XXXXXXXX`.
3. Poll every 3s for status=ACTIVE (10 minute window).

### 3c. The merchant (or you) opens the URL

- Visit the printed URL in a browser.
- Shopify shows the install/scope-approval screen for the merchant's store.
- Merchant clicks **Install app**.
- Redirects to Composio → "Connection successful" page.

### 3d. Script confirms ACTIVE + runs smoke test

Script automatically:
- Detects status flip from INITIATED → ACTIVE.
- Calls `SHOPIFY_GET_SHOP_DETAILS` and `SHOPIFY_COUNT_PRODUCTS` to confirm the token works.
- Prints `connected_account_id` (format: `ca_...`).

**Record the `connected_account_id`** against the merchant's workspace.

---

## Step 4 — Use from Automatos Orchestrator

Every tool execution needs three things:

| Parameter | Source |
|---|---|
| `userId` | The merchant's `COMPOSIO_ENTITY_ID` (workspace public_id) |
| `version` | **`20260414_00`** — pin this! (See Gotcha #1 below) |
| `arguments` | Tool-specific |

Example:
```javascript
await composio.tools.execute("SHOPIFY_COUNT_PRODUCTS", {
  userId: workspace.public_id,
  arguments: {},
  version: "20260414_00",
});
```

Available tools: **394 total** — product, order, customer, inventory, collection, content, discount, fulfillment, metafield, theme, etc. List them via:

```javascript
await composio.tools.getRawComposioTools({ toolkits: ["shopify"], limit: 400 });
```

---

## Gotchas (learned the hard way)

### 1. Toolkit version must be pinned
Tool execute calls **fail** with "Toolkit version not specified" unless you pass `version: "20260414_00"` (or whatever the current version is — check `https://docs.composio.dev/toolkits/shopify`).

**Fix:** Set it globally on the Composio client:
```javascript
new Composio({
  apiKey: COMPOSIO_API_KEY,
  toolkitVersions: { shopify: "20260414_00" },
});
```

### 2. Composio UI is limited to 4 scopes
The Composio dashboard UI for Shopify auth config creation only offers 4 scopes (products + orders). **Always create auth configs programmatically** — the SDK accepts the full Shopify scope list via `credentials.scopes` as a comma-separated string.

### 3. Both v1 and v3 redirect URLs required on Shopify
Composio's actual OAuth callback is `.../api/v1/auth-apps/add`. Their public docs reference `.../api/v3/toolkits/auth/callback`. **Add both to the Partner app redirect allow list** or OAuth will fail with `redirect_uri not whitelisted`.

### 4. "Use legacy install flow" — superseded
**Originally** this had to be CHECKED. We removed it on 2026-04-23 (`8097891 fix(shopify): unblock app deploy`) because it's incompatible with `[[webhooks.subscriptions]]` (app-specific webhooks). Composio's OAuth callback works without it as long as your app uses app-specific webhooks throughout. Do NOT re-enable.

### 5. Partner App changes require a new release
Saving the Shopify Partner App config does nothing until you also cut a new release. If OAuth errors persist after "saving", check that your release is current.

### 6. Adding scopes later requires merchant re-auth
The scopes baked into the auth config are what Shopify asks the merchant to approve. Adding new scopes later = every merchant must re-authorize. **Commit to the full scope list up-front.**

### 7. Entity ID must exist in Composio before initiation
`COMPOSIO_ENTITY_ID` = the workspace's public_id or any stable string you use as the Composio "user". Composio creates the entity on first use. Use the merchant's Automatos workspace `public_id` for 1:1 mapping.

### 8. Composio Shopify toolkit is NOT composio-managed
`isComposioManaged: false` on the auth config is expected. This is why you need your own Partner app OAuth credentials — Composio doesn't ship a default Shopify OAuth app.

### 9. Per-client auth configs are mandatory under the per-merchant Partner app model
Each merchant's Partner app has a unique `client_id` (since each is created inside their own Dev Dashboard, not in a shared Partner Dashboard org). Composio binds an auth config to one `client_id` at creation time. **You cannot reuse one auth config across merchants** — Composio's OAuth handshake will fail with credential mismatch. Run `scripts/composio-setup.mjs` against each merchant's credentials and record the resulting `ac_*` ID per row in `docs/SHOPIFY/CLIENTS.md`.

### 10. Tool slugs differ from intuitive names
Naive guesses like `SHOPIFY_LIST_PRODUCTS` will 404. The verified slugs we use:
- `SHOPIFY_GET_SHOP_DETAILS` — shop metadata (smoke test)
- `SHOPIFY_COUNT_PRODUCTS` — product count (smoke test)
- `SHOPIFY_GET_PRODUCTS_LIST` — list products (correct slug for what most people would call "list products")

To enumerate the full set when slugs change: `composio.tools.getRawComposioTools({ toolkits: ["shopify"], limit: 400 })`.

---

## Quick reference — per-merchant IDs

Recorded one row per merchant. See `docs/SHOPIFY/CLIENTS.md` for the canonical registry.

| Merchant | client_id | auth_config_id | connected_account | entity_id |
|---|---|---|---|---|
| 1lovefragrance.myshopify.com | `f184b73f2d841c1972744565325d3548` | `ac_iOROGtpG6qVR` | `ca_hV499ZT66IGB` | `c71e4753-97ad-4d52-bfa0-f2a90c0a384b` |
| innobuilduk.myshopify.com | `45e95118e2a94a53ac44ce9ccf494836` | _(create via Step 2)_ | _(create via Step 3)_ | _(workspace public_id from `/api/shopify/provision`)_ |

Toolkit version (shared): `20260414_00` — pin globally on the Composio client. Update if Composio bumps it.

---

## If something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| `Default auth config not found for toolkit shopify` | Trying to create via API without `type: "use_custom_auth"` | Pass `type: "use_custom_auth"` + full credentials |
| `Couldn't fetch Toolkit with slug: [object Object]` | Wrong SDK method signature | Use positional args: `getAuthConfigCreationFields("SHOPIFY", "OAUTH2", { requiredOnly: false })` |
| `Oauth error invalid_request: redirect_uri is not whitelisted` | Missing v1 URL in Partner app | Add `https://backend.composio.dev/api/v1/auth-apps/add` + release |
| `Toolkit version not specified` | Missing `version` on tool execute | Pass `version: "20260414_00"` or pin in Composio client config |
| `Tool SHOPIFY_LIST_PRODUCTS not found` | Wrong slug (there is no `_LIST_PRODUCTS` — Composio uses different names) | List real tools via `getRawComposioTools`; product retrieval is `SHOPIFY_GET_PRODUCTS_LIST` or similar |
| Connection stuck at `INITIATED` forever | Merchant hasn't completed OAuth in browser | Re-send the authorize URL; ensure they click **Install** |
| UI-created auth config only has 4 scopes | Known Composio limitation | Create programmatically instead (see Step 2) |

---

## Fallback Plan B

If Composio's Shopify toolkit ever breaks or you hit scope ceilings:

1. **Self-hosted MCP** — `callobuzz/cob-shopify-mcp` (64 tools, YAML-extensible, you control scopes 100%). See `SHOPIFY-MCP-EVALUATION.md`.
2. **Direct Shopify Admin API client** — wrap Shopify's Admin GraphQL directly in a new orchestrator tool category. Maximum control, no middleman. Use `@shopify/shopify-api` (already in the repo's package.json).

Switching execution layer later = swap the tool resolver. Agents, skills, widgets, workspace provisioning all stay the same.

---

## Scripts referenced in this doc

- `scripts/composio-setup.mjs` — create the shared auth config (Step 2)
- `scripts/composio-resume.mjs` — per-merchant connection initiation + smoke test (Step 3)
- `scripts/composio-check.mjs` — status check + smoke test for an existing connection

All three are PoC-grade. For production, port their logic into the orchestrator's Composio service so merchants self-serve via the Automatos dashboard.
