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
