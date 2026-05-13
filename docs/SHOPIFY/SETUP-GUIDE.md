# Shopify App — PoC Testing Guide

**Date:** 2026-04-12
**For:** Gerard — step-by-step to get the app running on your dev store
**Estimated time:** 1 hour

---

## What's Built (All Dev Complete)

| Component | Location |
|-----------|----------|
| Shopify app (React Router 7 + Polaris) | `automatos-shopify/app/` |
| Admin pages: Dashboard, Agents, Widgets, Settings | `app/routes/app.*.tsx` |
| Theme extension (4 Liquid blocks) | `extensions/automatos-theme/blocks/` |
| OAuth install → workspace provisioning | `app/routes/auth.callback.tsx` |
| Webhook handlers | `app/routes/webhooks.app.tsx` |
| Automatos API client (server-side) | `app/automatos.server.ts` |
| **Provisioning API endpoints** | `orchestrator/api/shopify.py` |
| Widget SDK (chat, blog, loader) | `automatos-widget-sdk/` |
| Widget API (chat, blog, auth, CORS, rate limit) | `orchestrator/api/widgets/` |
| 12 Shopify marketplace agents | Production DB (IDs 343-354) |
| 20 SKILL.md files | `automatos-skills/` |
| Build script (SDK → extension assets) | `scripts/build-widgets.sh` |

---

## PoC Testing Steps

### Step 1: Build Widget SDK (5 min)

```bash
cd ~/Development/Automatos-AI-Platform/automatos-shopify
nvm use 20
./scripts/build-widgets.sh
```

This builds `@automatos/loader` and copies `widget.js` into the theme extension assets.

### Step 2: Install App Dependencies (2 min)

```bash
cd ~/Development/Automatos-AI-Platform/automatos-shopify
npm install
npx prisma generate
npx prisma migrate dev --name init
```

### Step 3: Create Shopify Partner App (10 min)

1. Go to https://partners.shopify.com → Apps → Create app → Create app manually
2. App name: **Automatos AI**
3. Copy the **Client ID** and **Client Secret**
4. Update `shopify.app.toml`:
   ```toml
   client_id = "YOUR_CLIENT_ID"
   ```
5. Create `.env`:
   ```env
   SHOPIFY_API_KEY=YOUR_CLIENT_ID
   SHOPIFY_API_SECRET=YOUR_CLIENT_SECRET
   SCOPES=read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,read_content,write_content,read_themes
   AUTOMATOS_API_URL=https://your-railway-url.up.railway.app
   AUTOMATOS_API_KEY=your_internal_key
   ```

### Step 4: Set Railway Environment Variables (5 min)

Add these to the orchestrator service on Railway:

```
SHOPIFY_INTERNAL_API_KEY=<generate a secret, match AUTOMATOS_API_KEY in .env above>
WIDGET_ORIGIN_ALLOWLIST=*.myshopify.com,localhost:3000
```

The `SHOPIFY_INTERNAL_API_KEY` secures the Shopify app → Automatos API calls.
The `WIDGET_ORIGIN_ALLOWLIST` allows widget chat from Shopify storefronts.

### Step 5: Deploy Orchestrator (5 min)

Push the new `api/shopify.py` and `config.py` changes to Railway so the provisioning endpoints are live:

```bash
cd ~/Development/Automatos-AI-Platform/automatos-ai
git add orchestrator/api/shopify.py orchestrator/main.py orchestrator/config.py
git commit -m "feat: Shopify provisioning API endpoints"
git push
```

### Step 6: Start the App (2 min)

```bash
cd ~/Development/Automatos-AI-Platform/automatos-shopify
npm run dev
```

This runs `shopify app dev` which:
- Starts a Vite dev server
- Creates a Cloudflare tunnel for HTTPS
- Registers the app URL with Shopify Partners
- Opens the install URL in your browser

### Step 7: Install on Dev Store

Click the install URL the CLI gives you. This triggers:

1. Shopify OAuth → access token granted
2. `auth.callback.tsx` → calls `POST /api/shopify/provision`
3. Automatos creates workspace, clones 9 agents, generates API key
4. Redirects to app dashboard

### Step 8: Verify Admin UI

In the Shopify admin, open the Automatos app. You should see:

- [ ] **Dashboard** — widget cards (Support Chat, Product Q&A, Blog, etc.)
- [ ] **Agents** — table with 9 agent rows
- [ ] **Widgets** — catalog with 9 widgets, Configure buttons on Tier 1
- [ ] **Settings** — theme, model, API key, subscription
- [ ] **Nav menu** — Dashboard, Agents, Widgets, Settings all work

### Step 9: Test Theme Extension

1. Go to **Online Store → Customize**
2. Click **App embeds** (left sidebar, bottom)
3. Enable **Automatos Support Chat**
4. Configure: paste the API key from provisioning, set agent ID
5. Navigate to a product template
6. Add **Automatos Product Q&A** block
7. Preview the theme — you should see the chat FAB and Q&A block

### Step 10: Test Widget Chat (End-to-End)

1. Open the dev store storefront (the preview URL)
2. Click the chat FAB (bottom right)
3. Type a message
4. Verify SSE streaming response appears
5. Check the conversation persists on page navigation

---

## Per-client install workflow (the working pattern)

This is the simplest and most reliable way to install the Automatos Partner app on a new merchant. **Each merchant has their own copy of the `automatos-ai` app inside their own Dev Dashboard**. The master `shopify.app.toml` in this repo is the canonical scopes + extension definition; per-client tomls (`shopify.app.<client>.toml`) get derived from it.

This pattern was proven on `1lovefragrance` and re-validated on INBUILD UK.

### Why this and not `shopify app dev`?

`shopify app dev` (Cloudflare tunnel mode) is for **YOUR own local development** of the Shopify app — iterating on `auth.callback.tsx`, embedded admin routes, webhook handlers, against a dev store you own. It's the wrong tool for client installs:

- The tunnel is temporary; dies when you stop the CLI
- It requires the target store to be a dev store of the Partner org owning the app — won't install cross-org
- It updates the Partner app URL globally, affecting any other in-flight install

For client installs, use the deploy-based flow below.

### Steps

```bash
# 1. Link this repo to the merchant's Dev Dashboard app
shopify app config link
#    - Pick organization → merchant's Dev Dashboard org (e.g. "INBUILD UK")
#    - Pick app → existing automatos-ai if one exists, otherwise create new
#    - Pick config name → e.g. "automatos-ai"
#    Result: shopify.app.<config-name>.toml is written, linked to merchant's client_id.
#    Scopes (140) are auto-populated from the master shopify.app.toml.

# 2. Hand-copy missing config from shopify.app.toml into the new toml:
#    - [webhooks] block + [[webhooks.subscriptions]]  (GDPR + app/uninstalled + orders/create + shop/update)
#    - [auth] redirect_urls  (Composio backend URLs — only if Composio is in scope for this client)
#    - application_url  (point at deployed Shopify app server if embedded admin is needed; otherwise leave the placeholder)

# 3. Deploy to the merchant's app
shopify app deploy
#    Pushes scopes, webhooks, theme extension (chat-widget, product-qa, blog-widget, review-summary).
#    Creates a new "version" in the merchant's Dev Dashboard.

# 4. Install on the merchant's store via Dev Dashboard
#    dev.shopify.com/dashboard/<merchant-org-id>/apps/automatos-ai
#    → Click "Install app"
#    → Pick target store (e.g. innobuilduk.myshopify.com)
#    → Approve scope screen
#    Result: app installed; theme extension available in merchant's Theme customizer.

# 5. Mint the Automatos workspace + public widget API key (out-of-band; install does not auto-trigger this)
curl -X POST https://api.automatos.app/api/shopify/provision \
  -H "Content-Type: application/json" \
  -d '{
    "source": "shopify",
    "external_id": "<store>.myshopify.com",
    "name": "<Merchant Name>",
    "metadata": {"shopify_domain": "<store>.myshopify.com"}
  }'
#    Response includes workspace public_id and api_key. Save both.

# 6. Configure widget on the merchant's chosen theme
#    Merchant admin → Online Store → Themes → <target theme> → Customize
#    → Theme settings → App embeds → Automatos AI Widgets → toggle ON
#    → Paste the api_key + agent_id from step 5
#    → Save (do NOT publish if using an unpublished theme as a sandbox)

# 7. Verify on theme preview URL
#    - Open preview URL → confirm widget loads + chat responds
#    - Open published storefront → confirm no widget renders (if using unpublished theme)

# 8. (Optional) Enable PRD-007 proactive engagement
#    Default is OFF after provisioning. Flip on once merchant has approved
#    the brand-voice opener. See "Proactive engagement activation" below.

# 9. Update docs/SHOPIFY/CLIENTS.md with the new merchant row.
```

---

## Proactive engagement activation (PRD-007)

**Merchant-facing path (recommended).** Three settings in the chat-widget theme
block, ticked from the same place the merchant pasted their API key. No
workspace IDs, no curl, no SQL.

### What the merchant does (30 seconds)

1. Merchant admin → **Online Store → Themes → [their theme] → Customize**.
2. **App embeds** (sidebar) → **Automatos Support Chat**.
3. Scroll to **Proactive engagement (beta)** section:

   | Setting | Default | What it does |
   |---|---|---|
   | ☐ **Enable proactive popups** | off | Master switch. Off until ticked. |
   | **Popup delay (seconds)** | 20 | How long the shopper sits on a product page before the popup appears. Range 5–120. |
   | **Popup message** | "Need a hand finding the right product?" | Shown immediately while the agent generates a product-specific opener (which replaces it within ~1.5s). |

4. Tick **Enable proactive popups**.
5. **Save**.
6. Storefront preview → product page → wait the configured delay → corner-bubble
   popup appears with a contextual one-line opener referencing the product.

That's it. Same theme-customizer flow the merchant already knows from pasting
their API key. No backend access required.

### How it works under the hood

The theme block passes a `proactiveOverride` object to the SDK on init:

```js
proactiveOverride: {
  enabled: true,        // from the checkbox
  seconds: 20,          // from the range slider
  message: "..."        // from the text input
}
```

The SDK merges this with the workspace-level config (`workspace.settings.widget_proactive`):

- **`enabled`** uses OR semantics — either source flipping it on fires the popup.
- **`seconds`** and **`message`** from the theme win when supplied.
- **All other tunables** (popup_style, page_types, frequency_cap, etc.) come from the workspace config (or hardcoded v1 defaults if no workspace config exists).

This means platform admins can still adjust advanced behaviour per-merchant via the workspace settings (when the dashboard UI lands; for now via DB), while the merchant's day-to-day on/off control is a single checkbox in the theme.

### Default config seeded into every new Shopify workspace

Set by `POST /api/shopify/provision`:

```jsonc
{
  "widget_proactive": {
    "enabled": false,                          // opt-in
    "page_types": ["product"],                 // fire on product pages only
    "triggers": [{ "type": "time_on_page", "seconds": 20 }],
    "frequency_cap": { "scope": "session", "max_pops": 1 },
    "greeting_source": "agent_with_canned_fallback",
    "canned_fallback": "Need a hand finding the right product?",
    "agent_timeout_ms": 1500,                  // canned shown if LLM > 1.5s
    "popup_style": "corner_bubble",
    "respect_consent": true,                   // honour GDPR cookie consent
    "dismissal_persistence": "session"
  }
}
```

### To disable

Untick the checkbox in the theme customizer → Save. Or change `page_types` / `triggers` workspace-side for finer control.

### Cross-references

- PRD: `docs/PRDS/PRD-007-PROACTIVE-WIDGET-ENGAGEMENT.md`
- SDK behaviour: `automatos-widget-sdk/docs/EMBEDDING.md` §3a
- Orchestrator endpoints: `GET /api/widgets/config` (SDK init), `POST /api/widgets/chat` (page_context + trigger_reason fields)
- Skill prompt: `automatos-skills/shopify/shopify-support/SKILL.md` § "Proactive Opener Mode"
- Deploy procedure: `docs/RUNBOOKS/release-procedure.md`

### What this does NOT do to the live storefront

- **No widgets render anywhere yet** after install. App embeds are OFF by default in every theme. The merchant has to explicitly toggle ON per theme.
- **No webhooks fire on historical data.** Subscriptions only see new events post-install.
- **No agent actions execute** until invoked via the embedded admin or a widget conversation.
- **The published theme is untouched** unless you (or the merchant) explicitly toggle the Automatos embed ON inside it. Keep it OFF in published themes during demos.

### Rollback

| Stage | How to abort | Result |
|---|---|---|
| Before step 4 (no install yet) | Just stop. Nothing has touched the merchant's store. | Zero merchant impact. |
| Step 4 scope screen visible | Click **Cancel** | No install, no traces. |
| After step 4 (app installed) | Merchant admin → Apps → Automatos AI → Uninstall | `app/uninstalled` webhook fires → orchestrator soft-deletes workspace. Theme extension files removed from store. |
| Live storefront protection | Toggle the Automatos embed ON only in unpublished themes (e.g. "AI Testing"). | Real shoppers see zero Automatos activity. |

### Gotchas / notes

- **Per-client tomls are local, not shared.** `shopify.app.<client>.toml` lives only in your repo clone. Treat as a local working file. Recommendation: add `shopify.app.*.toml` to `.gitignore` while keeping the master `shopify.app.toml` tracked.
- **Each merchant's app has its own `client_id`.** From Shopify's POV they're separate apps. Composio auth configs are bound to a `client_id`, so each merchant needing Composio gets their own auth config (run `scripts/composio-setup.mjs` against each one).
- **Placeholder `application_url`** (`https://shopify.dev/apps/default-app-home`) is fine for installs where you only need theme extension + widgets. The embedded admin won't render — that's only needed if the merchant clicks "Open app" inside their admin. For widget-only PoCs, leave the placeholder.
- **`shopify app config link` only auto-syncs scopes.** Webhooks and redirect URLs are not copied — you have to hand-copy from `shopify.app.toml`. (Worth scripting in the future.)
- **`shopify app deploy` against a per-client toml only affects that merchant's app.** Other merchants' apps are unaffected. Same goes for installs and webhooks.

---

## Provisioning API Reference

These endpoints are called by the Shopify app, secured by `SHOPIFY_INTERNAL_API_KEY`:

| Endpoint | When | What |
|----------|------|------|
| `POST /api/shopify/provision` | App install | Creates workspace, clones 9 agents, returns public API key |
| `POST /api/shopify/connect` | After provision | Stores Shopify access token for Composio |
| `POST /api/shopify/deactivate` | App uninstall | Soft-deletes workspace |
| `POST /api/shopify/sync` | shop/update webhook | Updates shop metadata |
| `POST /api/shopify/events` | orders/create webhook | Forwards events for agent context |

---

## Architecture Diagram

```
YOUR DEV STORE (*.myshopify.com)
│
│  Theme Extension (Shopify CDN)
│  └── widget.js → AutomatosWidget.init({ apiKey, agentId })
│
│  POST /api/widgets/chat
│  Authorization: Bearer ak_pub_...
│
▼
AUTOMATOS ORCHESTRATOR (Railway)
├── /api/shopify/*      ← Shopify app server calls (provisioning)
├── /api/widgets/*      ← Widget SDK calls (chat, blog, auth)
├── /api/marketplace/*  ← Agent marketplace browsing
└── /api/workspaces/*   ← Workspace management
│
▲
│  POST /api/shopify/provision
│  Authorization: Bearer <SHOPIFY_INTERNAL_API_KEY>
│
SHOPIFY APP (localhost via Cloudflare tunnel)
├── app/routes/auth.callback.tsx  → provisions workspace on install
├── app/routes/app._index.tsx     → admin dashboard
├── app/routes/webhooks.app.tsx   → event forwarding
└── app/automatos.server.ts       → API client
```

---

## Troubleshooting

**"Shopify CLI not found"**
```bash
nvm use 20
npm install -g @shopify/cli@latest
```

**Widget not loading on storefront**
- Check `WIDGET_ORIGIN_ALLOWLIST` includes `*.myshopify.com`
- Check browser console for CORS errors
- Verify `widget.js` exists in `extensions/automatos-theme/assets/`

**Provisioning fails on install**
- Check Railway logs for the orchestrator
- Verify `SHOPIFY_INTERNAL_API_KEY` matches between `.env` and Railway
- The app gracefully handles provisioning failures — install still completes

**Chat returns 401/403**
- Verify the API key was created during provisioning
- Check the key's `allowed_domains` includes the dev store domain

---

## File Reference

```
automatos-shopify/
├── app/
│   ├── automatos.server.ts        # Automatos API client
│   ├── shopify.server.ts          # Shopify OAuth + API
│   ├── db.server.ts               # Prisma client
│   ├── entry.server.tsx           # SSR entry
│   ├── root.tsx                   # HTML shell
│   └── routes/
│       ├── app.tsx                # Layout + NavMenu
│       ├── app._index.tsx         # Dashboard
│       ├── app.agents.tsx         # Agent team table
│       ├── app.widgets._index.tsx # Widget catalog
│       ├── app.widgets.$slug.tsx  # Per-widget config
│       ├── app.settings.tsx       # Settings
│       ├── auth.$.tsx             # OAuth handler
│       ├── auth.callback.tsx      # Post-install provisioning
│       ├── auth.login/route.tsx   # Login form
│       └── webhooks.app.tsx       # Webhook handlers
├── extensions/
│   └── automatos-theme/
│       ├── blocks/
│       │   ├── chat-widget.liquid      # FAB chat (app embed)
│       │   ├── product-qa.liquid       # PDP inline Q&A
│       │   ├── blog-widget.liquid      # Blog grid/list
│       │   └── review-summary.liquid   # Review pros/cons
│       ├── assets/widget.js            # Built from SDK
│       ├── locales/en.default.json
│       └── shopify.extension.toml
├── scripts/
│   └── build-widgets.sh               # SDK build + copy
├── prisma/schema.prisma
├── shopify.app.toml
├── package.json
├── vite.config.ts
├── tsconfig.json
├── react-router.config.ts
├── .nvmrc                              # Node 20
├── .env.example
└── docs/SHOPIFY/

automatos-ai/orchestrator/
├── api/shopify.py                     # Provisioning endpoints (NEW)
├── api/widgets/                       # Widget API (existing)
│   ├── chat.py, blog.py, session.py
│   ├── auth.py, cors.py, rate_limit.py
│   └── router.py
├── config.py                          # SHOPIFY_INTERNAL_API_KEY (NEW)
└── main.py                            # Router registration (UPDATED)
```
