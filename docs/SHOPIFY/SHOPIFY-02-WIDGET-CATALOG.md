# Shopify Widget Catalog — 10-20 Widgets, Powered by Automatos

**Status:** Research / product roadmap
**Owner:** Gerard
**Date:** 2026-04-12
**Goal:** Ship 10-20 widgets in 90 days, each powered by a dedicated Automatos agent, each carrying "Powered by Automatos" footer distribution.

---

## The model (recap)

- **One Automatos app** listed on Shopify App Store
- **Widget library** lives inside the app — merchants pick widgets, assign agents, drop snippets into theme or App Bridge
- **Subscription required** — widgets are the delivery mechanism, the AI team is the product
- **Every widget has a default agent** that ships with the Mission Zero seed team; merchants can swap to custom agents
- **"Powered by Automatos" badge** non-removable on lower tiers, optional on Pro, removable on Enterprise

---

## Widget architecture (what's already built)

- `@automatos/core` — auth, API client, SSE parser, types
- `@automatos/chat-widget` — Shadow DOM chat UI (~8KB gzip)
- `@automatos/blog-widget` — grid/list/featured/minimal post layouts (scaffolded, PRD in flight)
- `@automatos/loader` — `widget.js` CDN entry point
- `@automatos/widget-sdk` — React wrappers
- Backend: `orchestrator/api/widgets/` with auth, chat, blog, data, documents, docs, session, CORS, rate limit
- Marketplace tables: `widget_marketplace.py`, `marketplace_widget.py`, `widget_review.py`, `widget_installation.py`

**Every new widget type reuses the core layer.** The work is UI shell + Shopify integration + agent wiring — not plumbing.

---

## Widget catalog

### Tier 1 — Ship first (weeks 1-4)

These exist in the SDK or are trivial extensions. High value, low effort.

#### 1. Conversational Support Chat (FAB)
- **What:** Floating chat button, bottom-right, answers shopper questions
- **Agent:** Support Agent (per merchant, trained on their policies)
- **Effort:** Already built — config-only
- **Value:** Deflects support tickets, answers pre-sales questions, 24/7

#### 2. Inline Product Q&A
- **What:** Embedded Q&A block on product pages, bound to the product's SKU
- **Agent:** Product Expert Agent
- **Effort:** 0.5-1 day — extends chat widget with `containerSelector` + PDP context
- **Value:** Answers from spec sheets + reviews + description, reduces "does this fit my X?" emails

#### 3. Blog Widget (auto-published content)
- **What:** Inline `/blog` listing + detail view, renders agent-authored posts
- **Agent:** SEO/Content Agent
- **Effort:** 1-3 days — finish in-flight PRD (11 user stories)
- **Value:** SEO traffic, always-fresh content, zero merchant writing time

#### 4. Daily Business Brief (admin widget via App Bridge)
- **What:** Embedded in Shopify admin — sales, traffic, inventory, ad spend, next actions
- **Agent:** Business Analyst Agent
- **Effort:** 1-2 days — new admin-surface widget using Shopify App Bridge
- **Value:** Merchant sees Automatos every time they open admin, daily habit loop

#### 5. Inventory Watchdog (admin widget)
- **What:** Stockout alerts, reorder suggestions, slow-mover flags
- **Agent:** Inventory Agent
- **Effort:** 1 day — reuses business brief pattern
- **Value:** Prevents out-of-stock revenue loss, automates reorder timing

### Tier 2 — Ship next (weeks 4-8)

More bespoke, higher novelty, stronger demo moments.

#### 6. Review Summarizer
- **What:** "What do people actually say?" on PDP — agent reads all reviews, gives honest pros/cons with cited quotes
- **Agent:** Review Analyst Agent
- **Effort:** 1-2 days
- **Value:** Shoppers trust summaries more than star averages, unique feature

#### 7. Gift Finder Quiz
- **What:** 5-question conversational quiz → personalized shortlist
- **Agent:** Gift Concierge Agent
- **Effort:** 1-2 days — state machine on top of chat core
- **Value:** Gift-buyers are high-intent, under-served by standard search

#### 8. Conversational Shopper
- **What:** "I need X for Y" → catalog search + recommendations in chat format
- **Agent:** Merchandising Agent
- **Effort:** 1-2 days
- **Value:** Replaces on-site search for discovery use cases

#### 9. Size/Fit Advisor
- **What:** Fashion-specific — 3 questions, recommends size based on returns data
- **Agent:** Fit Agent
- **Effort:** 1-2 days
- **Value:** Fashion stores bleed on size returns, measurable ROI

#### 10. Abandoned Cart Save-the-Sale
- **What:** On exit-intent, agent asks "what stopped you?" and responds live
- **Agent:** Save-the-Sale Agent
- **Effort:** 1 day — exit-intent trigger + chat core
- **Value:** Recovers cart-abandonment revenue in real time, not via email

### Tier 3 — High novelty (weeks 6-12)

Unique to Automatos, nothing similar in the market.

#### 11. Visual Search
- **What:** Shopper uploads an image, vector search finds similar products
- **Agent:** Vision Agent with image embeddings
- **Effort:** 2-3 days — image embedding pipeline + search UI
- **Value:** Category-defining feature, huge demo moment

#### 12. AI Stylist / Bundler
- **What:** Builds outfits or kits from cart / wishlist / catalog
- **Agent:** Merchandising Agent with bundling skill
- **Effort:** 2 days
- **Value:** AOV uplift, creative experience

#### 13. Post-Purchase Concierge
- **What:** Embedded in order status page — tracking, returns, support
- **Agent:** Support Agent with Shopify Admin API access
- **Effort:** 1-2 days
- **Value:** Deflects post-purchase tickets, the highest-volume support category

#### 14. Loyalty Concierge
- **What:** "How close to next tier, what's worth my points?"
- **Agent:** Loyalty Agent with points API integration
- **Effort:** 1-2 days
- **Value:** Drives loyalty engagement, sticky

#### 15. Ad Performance Explainer (admin)
- **What:** Pulls Meta/Google ad data, explains what's working in plain English
- **Agent:** Ad Analyst Agent
- **Effort:** 2 days — Composio integrations for ad platforms already available
- **Value:** Replaces expensive ad consultants for small merchants

### Tier 4 — Content / SEO (weeks 8-12)

These are not chat widgets — they're content surfaces powered by agents.

#### 16. SEO Metadata Injector
- **What:** Agent rewrites meta tags + JSON-LD schema per page based on what ranks
- **Agent:** SEO Agent
- **Effort:** 2 days — new widget type, writes to `<head>` not visible UI
- **Value:** Organic traffic lift, set-and-forget

#### 17. FAQ Auto-Generator
- **What:** Agent pulls top support tickets, writes answers, publishes as FAQ block
- **Agent:** FAQ Agent
- **Effort:** 1-2 days
- **Value:** Reduces ticket volume, always current

#### 18. Buyer's Guide Widget
- **What:** Long-form content block "How to choose X" — SEO bait, agent-written
- **Agent:** Content Agent with category expertise
- **Effort:** 1-2 days
- **Value:** Captures top-of-funnel search traffic

#### 19. Landing Page Section Authoring
- **What:** Agent-authored hero copy, testimonial selection, feature blocks for campaign pages
- **Agent:** Copywriter Agent
- **Effort:** 2 days — section composer widget
- **Value:** Replaces copywriting agencies for campaign launches

#### 20. Schema.org Rich Results Optimizer
- **What:** Auto-generated JSON-LD schema for Google rich results (product, reviews, breadcrumbs, FAQ)
- **Agent:** SEO Agent
- **Effort:** 1 day
- **Value:** Rich results = higher CTR from search

---

## Widget → Agent binding model

Every widget type has a **default agent** that ships with Mission Zero. Merchants can:

1. Use the default agent (zero config)
2. Swap to a custom agent via widget config (`agentId` param)
3. Build a new agent via the wizard or A-Team and assign it to the widget

Each widget instance is one agent. For multi-agent flows (e.g. a chat that routes to different specialists), the agent itself does the routing via sub-agent tools.

---

## Pricing and gating

| Plan | Widgets included | Agents | Monthly interactions | Powered-by badge |
|---|---|---|---|---|
| Starter (£99) | 3 widgets | 2 agents | 10K | Required |
| Growth (£299) | 10 widgets | 5 agents | 50K | Required |
| Pro (£799) | Unlimited | 15 agents | 250K | Optional |
| Enterprise (custom) | Unlimited | Unlimited | Volume pricing | White-label |

**Pricing is metered on interactions, not widget count.** More widgets = more stickiness, not more cost. We want merchants running every widget we ship.

---

## Distribution math — why the badge matters

If 500 merchants install Automatos and each has 10K shopper sessions/month:
- **5,000,000 "Powered by Automatos" impressions per month**
- Click-through at even 0.1% = 5,000 landing page visits per month, organic
- Compounding — every new merchant adds their traffic to the flywheel
- Zero marginal distribution cost
- Defensible only because every merchant carries the badge by default on Starter/Growth

This is the Stripe / Intercom / Typeform model applied to Shopify widgets. The badge is a non-negotiable on the cheaper tiers.

---

## Development approach

- **One widget per week** as a rough cadence after the Tier 1 set is shipped
- **Reuse, don't rebuild** — every new widget extends `@automatos/core` + a UI shell
- **Playwright tests per widget** — each widget has a smoke test that hits Inbuild's staging theme
- **Dogfood on Inbuild first** — no widget ships to general merchants until it's lived on Inbuild for a week
- **Agent seed templates live in `api/wizard.py`** — every new widget ships with its default agent template and skills

---

## What's missing from the widget SDK to make this real

### P0 — Ship-blocking bugs (fix before Inbuild deploy)

These are bugs in the existing SDK that will cause failures on a live Shopify store:

1. **`agentId` type mismatch** — `AutomatosChatProps.agentId` is typed as `number` but `AutomatosConfig.agentId` expects `string`. React wrapper passes the wrong type. Will break agent routing silently. (15 min fix)
2. **Blog widget `innerHTML` without client-side sanitization** — `PostDetail` uses `innerHTML` via `<template>` relying entirely on backend bleach. If backend config changes or a bypass is found, XSS is possible inside the Shadow DOM. Add DOMPurify or equivalent client-side layer. (half-day)
3. **Shopify privacy API compliance** — `AuthManager` writes to `sessionStorage` without checking `window.Shopify.customerPrivacy`. GDPR violation on Shopify storefronts. Must check consent before writing. (half-day)

### P1 — Feature gaps blocking Tier 1 widgets

4. **Inline chat mount** — chat widget only supports FAB; needs `containerSelector` support for inline embedding (half-day fix)
5. **PDP context injection** — widgets on product pages need to know which SKU they're on (half-day)
6. **Liquid app embed block template** — need a `shopify-app-extension/blocks/` directory with `{% schema %}` wiring, settings for API key, agent ID, theme. This is the actual integration layer Shopify requires. (half-day)

### P2 — Feature gaps blocking Tier 2-4 widgets

7. **Admin surface support** — App Bridge integration for admin-facing widgets (2 days)
8. **Per-session rate limiting** — current limits are per-API-key; needs per-visitor layer for busy storefronts (2 days)
9. **Theme auto-match** — widgets currently take manual `themeOverrides`; ideally read Shopify theme tokens automatically (2-3 days)
10. **Widget telemetry** — need interaction counts per widget per merchant for billing and analytics (2 days)
11. **CSP nonce support** — Shadow DOM `<style>` injection needs optional nonce attribute for strict CSP setups. Some Shopify themes enforce this. (half-day)
12. **Multiple widget instances** — loader guards against double-init, but Shopify themes can have the same app block in multiple sections. Blog widget needs to support multiple independent mounts on one page. (1 day)

### P3 — Resilience and production hardening

13. **SSE reconnection** — if the stream drops mid-response (flaky mobile connections), no automatic reconnection or resume. Shoppers on phones will get dead chat. (1 day)
14. **Request retry with backoff** — `sendMessage` doesn't retry on transient failures. Rate limit handling logs but doesn't queue for retry. (half-day)
15. **Shopify section re-render handling** — when Shopify re-renders a section via AJAX (section rendering API), any widget mounted inside gets destroyed. Blog widget needs MutationObserver or reinit hook. (1 day)
16. **i18n** — all strings hardcoded English ("No posts yet", "Type a message...", "Back to posts"). Shopify stores are multi-language. Need locale config or Shopify locale detection. (1-2 days)

### P4 — Code quality (ongoing)

17. **Test coverage** — only 22 unit tests, all in core (ConversationManager, EventBus, SSEParser). Zero tests for chat-widget, blog-widget, loader, or react packages. Zero integration/E2E tests. Target 80%+. (3-5 days)
18. **ConversationManager mutations** — `appendChunk`, `finalizeMessage`, `markSent`, `markError` all mutate in-place. Violates immutability standards. (half-day)
19. **Duplicated code** — `h()` helper copy-pasted between chat-widget and blog-widget (41 identical lines). `formatDate()` duplicated between post-card and post-detail. `clearElement()` duplicated. Extract to `@automatos/core` or a shared utils package. (half-day)
20. **Dead code** — `createTypingIndicator` in `typing-indicator.ts` is exported but never used; `MessageList.showTyping()` builds its own inline. Remove. (15 min)

P0 items are non-negotiable before Inbuild goes live. P1 items block Tier 1 widgets. P2-P4 are additive but needed for the full 20-widget catalog and production resilience.
