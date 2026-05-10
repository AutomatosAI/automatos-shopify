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

## Install flow walkthrough — what `npm run dev` actually does

When you're about to install on a client's live store and want to know exactly what's touching what, this is the play-by-play. Each step is annotated with **what gets changed where** and **how to safely abort**.

### Local-only — nothing on Shopify yet

1. **Vite dev server boots** on your machine. Your local app is now reachable at `http://localhost:<port>`. Nothing leaves your machine.
2. **Cloudflare tunnel opens.** Shopify CLI registers a temporary HTTPS endpoint (e.g. `https://abc-def.trycloudflare.com`) that proxies to your local server. Tunnel exists only while the CLI is running. Still no Shopify-side changes.

### Partner app config gets touched (your account, not any merchant)

3. **Partner app URL temporarily updated.** The CLI updates your Partner app's `application_url` and redirect URLs to the tunnel URL. Affects YOUR Partner Dashboard config only — no merchant store has been notified or modified. Reversible: when you stop the CLI, you can run `shopify app config push` to restore the canonical URLs from `shopify.app.toml` (or just leave it; the next dev session overwrites again).

### Install URL printed, decision pending

4. **CLI prints an install URL.** Looks like `https://<store>.myshopify.com/admin/oauth/authorize?client_id=...&scope=...&redirect_uri=...`. **Nothing is installed yet.** This URL is just an offer to install.
5. **You decide what to do.** Three options:
   - Paste in the merchant admin yourself → triggers step 6
   - Share the URL with the merchant → they click → triggers step 6
   - Close the terminal / `Ctrl+C` → tunnel dies, URL becomes invalid, no merchant impact

### Click happens — Shopify takes over

6. **Shopify's scope approval screen** appears in the merchant's admin. Lists every scope the app requests (currently 34). The clicker can:
   - **Cancel** → walks away clean, no install
   - **Install app** → proceeds
7. **OAuth grant created.** Shopify generates an access token internally and redirects the browser to your tunnel's `/auth/callback?code=...&hmac=...&shop=...`.
8. **Local `auth.callback.tsx` runs** (in your tunnelled local server). It:
   - Fetches shop metadata via Shopify GraphQL
   - Calls `POST /api/shopify/provision` on the orchestrator → workspace created, agents cloned, public widget API key minted
   - Calls `POST /api/shopify/connect` → stores the merchant's Shopify access token in the workspace settings
   - Logs `[automatos] provisioned <shop>: workspace=<UUID> agents=9 is_new=true key_prefix=ak_pub_xxxx...`
   - Redirects to the embedded app's `/app` route
9. **Merchant lands on the embedded app** in their Shopify admin under Apps → Automatos AI.

### What this does NOT do to the live storefront

- **No widgets render anywhere yet.** The theme extension is installed but every widget is OFF by default in every theme. App embeds are an opt-in toggle, per-theme. Customers see no change.
- **No webhooks fire on existing data.** Webhook subscriptions only fire on new events (e.g. an order placed *after* install). Existing orders, customers, products are not re-broadcast.
- **No automated agent actions execute.** Agents are seeded into the workspace but only run when explicitly invoked (via the embedded admin or a widget conversation).
- **The published theme is untouched.** Whatever's live for shoppers stays exactly as it was.

### Rollback at any point

| Stage | How to abort | Result |
|---|---|---|
| Steps 1–5 (before any click) | `Ctrl+C` the CLI | Tunnel dies, install URL invalid, zero merchant impact |
| Step 6 (scope screen visible) | Click **Cancel** | No install, no traces, walk away |
| After step 9 (app installed) | Merchant uninstalls via admin → Apps → Automatos AI → Uninstall | `app/uninstalled` webhook fires → orchestrator soft-deletes workspace. Theme extension files removed from store automatically. |
| Live storefront protection | Never toggle the Automatos embed ON in the **published** theme. Only enable it in unpublished themes (e.g. "AI Testing"). | Real shoppers see zero Automatos activity. |

### Recommended sequence for a nervous first run

1. **Dry-run on your own dev store first.** ~10 min. Run `npm run dev`, click the install URL on YOUR dev store, watch what the CLI prints, see the scope screen, see the post-install redirect, see the API key in console. Zero stakes.
2. **Then run on the client** with the same command. You already know what every screen is going to look like.

### Common stop points that look scary but aren't

- **CLI prompts to "select an organization"** — pick your Partner Dashboard org. One-time per machine.
- **CLI prompts to "select a development store"** — for a *test* install (vs live), pick a dev store. To install on a live merchant store, use the install URL the CLI prints rather than the dev-store picker.
- **"Use legacy install flow" warning** — if the Partner app hasn't been updated to the new install flow, this is normal. See `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md` Gotcha #4.
- **First call to `/api/shopify/provision` returns 422** in logs — usually means the request body is missing fields. Check `shopData` in `auth.callback.tsx` is being populated from the GraphQL response. (Only relevant if you see this; not a default failure mode.)

### When `shopify app dev` is NOT the right tool

- **Production / app-store distribution.** The tunnel is temporary. For permanent installs accessible to merchants without your laptop running, the app server needs to be deployed to a real host (Railway/fly.dev/etc) and `application_url` in `shopify.app.toml` must point at it.
- **Multiple concurrent installs.** Only one tunnel per dev session. If you need to install on multiple stores in parallel, each needs its own session OR a deployed server.

For the INBUILD UK PoC specifically, `shopify app dev` is sufficient — it's a one-off install we can babysit.

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
