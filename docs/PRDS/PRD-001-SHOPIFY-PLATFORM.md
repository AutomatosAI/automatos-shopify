# PRD: Shopify Platform Integration

**PRD ID:** SHOPIFY-001
**Status:** Draft
**Owner:** Gerard
**Date:** 2026-04-12
**Priority:** P0 — Primary revenue wedge

---

## Objective

Make Automatos the first multi-agent AI operations platform on the Shopify App Store. Anchor case study: Inbuild UK. 90-day delivery window starting after P1/P2 platform fixes land.

---

## Success Metrics

| Metric | Target | Deadline |
|---|---|---|
| Widgets shipped | 10 | Day 90 |
| Widgets live on Inbuild | 6-8 | Day 60 |
| App Store listing approved | Yes | Day 84 |
| Trial sign-ups | 200 | Day 90 |
| Paid conversions | 30 (15%) | Day 90 |
| "Powered by Automatos" impressions | 1M+ | Day 90 |
| P1/P2 platform fixes | 100% | Day 7 |

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        AUTOMATOS SHOPIFY                             │
│                   (automatos-shopify repo)                           │
├──────────────────────────────────────────────────────────────────────┤
│  Shopify App (React Router 7)                                        │
│  ├─ OAuth install → workspace creation + agent seeding               │
│  ├─ Admin UI (Polaris) → agent management, widget config, billing    │
│  └─ Webhook handlers → APP_UNINSTALLED, SHOP_UPDATE, orders, etc.   │
├──────────────────────────────────────────────────────────────────────┤
│  Theme Extension                                                     │
│  ├─ blocks/chat-widget.liquid      (App Embed Block, target: body)   │
│  ├─ blocks/blog-widget.liquid      (App Block, inline)               │
│  ├─ blocks/product-qa.liquid       (App Block, PDP inline)           │
│  ├─ blocks/review-summary.liquid   (App Block, PDP inline)           │
│  └─ assets/widget.js               (built from @automatos/loader)    │
├──────────────────────────────────────────────────────────────────────┤
│  Consumes:                                                           │
│  ├─ automatos-ai (API calls for chat, agents, workspace, missions)   │
│  ├─ automatos-widget-sdk (IIFE bundle as theme extension asset)      │
│  └─ automatos-skills (Shopify toolkit + merchant operations skills)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Workstreams

### WS-1: Platform Prerequisites (Week 1)

| Task | Owner | Status | Notes |
|---|---|---|---|
| P1 — Durable wizard pipeline | Gerard | **PoC tested** | Blocker — testing more system agents |
| P2 — Per-intake workspace isolation | Gerard | **Done** | Workspace isolation implemented |
| SDK P0 — Fix agentId type mismatch | Gerard | **Done** | React `number` → `string` |
| SDK P0 — Blog widget client-side sanitizer | Gerard | **Done** | Whitelist-based HTML sanitizer |
| SDK P0 — Shopify privacy API (GDPR) | Gerard | **Done** | `hasStorageConsent()` gate |
| SDK P0 — Remove dead typing-indicator | Gerard | **Done** | Deleted unused export |

### WS-2: Shopify App Scaffold (Week 1-2)

| Task | Owner | Status | Notes |
|---|---|---|---|
| Scaffold React Router 7 app | Gerard | **Done** | Manual scaffold with Polaris, React Router 7 |
| Generate theme extension | Gerard | **Done** | `extensions/automatos-theme/` with TOML config |
| Build Liquid blocks (chat, blog, Q&A, reviews) | Gerard | **Done** | 4 blocks with {% schema %}, settings, GDPR consent |
| Copy widget.js from SDK build into extension assets | Gerard | Not started | CI pipeline |
| Shopify OAuth → Automatos workspace creation | Gerard | **Done** | `auth.callback.tsx` → `automatosClient.provisionWorkspace()` |
| Agent seeding on install (12 agents from marketplace) | Gerard | **Done** | 12 agents seeded to production DB |
| Shopify Partner account registration | Gerard | Not started | 10 min, free |

### WS-3: Agent Design & Skills (Week 1-3)

| Task | Owner | Status | Notes |
|---|---|---|---|
| 4 core agents created (Ops, App Dev, Storefront, Extension) | Gerard | **Done** | Seeded to production DB (IDs 343-346) |
| 8 widget agent templates designed + seeded | Gerard | **Done** | Seeded to production DB (IDs 347-354) |
| Shopify Toolkit skills imported (16) | Gerard | **Done** | Already uploaded (IDs 213-228) |
| Merchant operations skills written (8) | Gerard | **Done** | Uploaded (IDs 229-236) |
| 4 core agent-role skills written | Gerard | **Done** | Uploaded, 3 rewritten to match Toolkit patterns |
| 8 widget agent-role skills written | Gerard | **Done** | Uploaded (IDs 241-248) |
| Agent seeding config for Mission Zero wizard | Gerard | Not started | Per-vertical templates |

### WS-4: MCP Server Evaluation (Week 2-4, parallel)

| Task | Owner | Status | Notes |
|---|---|---|---|
| Evaluate callobuzz/cob-shopify-mcp | Gerard | Not started | 64 tools, MIT, YAML-extensible |
| Evaluate GeLi2001/shopify-mcp | Gerard | Not started | 190 stars, simpler, proven |
| Containerize chosen MCP server | Gerard | Not started | Docker, single-store per instance |
| Multi-store proxy layer design | Gerard | Not started | Route by workspace → store instance |
| Decision: MCP vs Composio for Phase 1 | Gerard | **Decided** | Composio for Phase 1, MCP for Phase 2 |

### WS-5: Inbuild UK Pilot (Week 2-12)

| Task | Owner | Status | Notes |
|---|---|---|---|
| Confirm Inbuild owner participation | Gerard | Not started | **Critical path** |
| Identify backup merchant by week 4 | Gerard | Not started | Risk mitigation |
| Chat FAB live on Inbuild | Gerard | Not started | Week 3-4 |
| Product Q&A live on Inbuild PDPs | Gerard | Not started | Week 3-4 |
| Blog widget live on Inbuild /blog | Gerard | Not started | Week 5 |
| Admin widgets (Daily Brief, Inventory) | Gerard | Not started | Week 6 |
| Review Summarizer + Gift Quiz | Gerard | Not started | Week 8 |
| Capture receipts per widget | Gerard | Not started | Screenshots, video, metrics, quotes |
| Case study written | Gerard | Not started | Week 9-10 |

### WS-6: Launch (Week 9-12)

| Task | Owner | Status | Notes |
|---|---|---|---|
| App Store listing copy | Gerard | Not started | |
| Privacy/security documentation | Gerard | Not started | Required for review |
| Pricing page (£99/£299/£799/custom) | Gerard | Not started | |
| App Store submission | Gerard | Not started | Week 10 |
| Built for Shopify badge application | Gerard | Not started | 4-8 week review |
| Launch push (blog, social, Product Hunt) | Gerard | Not started | Week 12 |

---

## Dependencies

```
P1/P2 fixes ──→ Shopify scaffold ──→ Inbuild pilot ──→ App Store launch
                      │
SDK P0 fixes (DONE) ──┘
                      │
Agent design ─────────┘
                      │
Skills writing ───────┘
```

---

## Repo Map

| Repo | Role | Changes needed |
|---|---|---|
| `automatos-shopify` | Shopify app + theme extension | **New** — scaffold + build |
| `automatos-ai` | Core backend APIs | Shopify OAuth endpoint, agent seed templates |
| `automatos-widget-sdk` | Widget JS bundle | SDK P0 fixes (done), CI to copy build artifact |
| `automatos-skills` | Skill definitions | Add 8 merchant operations skills |

---

## Agent Architecture

### Tier 1: Platform Agents (from SHOPIFY-AGENTS-SPEC.md)

| Agent | Slug | Audience | Primary Tool |
|---|---|---|---|
| Operations Manager | `shopify-ops` | Merchants | Composio SHOPIFY |
| App Architect | `shopify-app-dev` | Developers | workspace_exec |
| Storefront Developer | `shopify-storefront-dev` | Developers | workspace_exec |
| Extension Builder | `shopify-extension-dev` | Developers | workspace_exec |

### Tier 2: Widget Agent Templates (scoped instances of Operations Manager)

| Template | Widget | Scoped Persona | Constrained Tools |
|---|---|---|---|
| Support Agent | Chat FAB | Answers shopper questions only | Order lookup, policy search, knowledge base |
| Product Expert | PDP Q&A | Answers product questions from specs + reviews | Catalog RAG, review RAG |
| Merchandising Agent | Conversational Shopper | Product recommendations | Catalog vector search |
| Review Analyst | Review Summarizer | Summarizes reviews into pros/cons | Review fetch, sentiment |
| Gift Concierge | Gift Finder Quiz | Quiz-based product matching | Catalog search, quiz state |
| SEO/Content Agent | Blog Widget | Writes and publishes blog posts | Web search, Blog API |

Each widget agent template inherits from Operations Manager but with:
- Narrower persona (can't do admin operations)
- Constrained tool access (only tools relevant to the widget's job)
- Widget-specific memory scope

---

## MCP Server Strategy

### Phase 1 (now): Composio
- 394 REST actions, auth managed, zero build time
- Known risk: Shopify deprecating REST for GraphQL (timeline: years)

### Phase 2 (month 2-3): Containerized MCP
- Fork `callobuzz/cob-shopify-mcp` (MIT, 64 tools, 600 tests, YAML-extensible)
- Containerize with Docker
- Add multi-store routing (workspace_id → store instance)
- Advantages: GraphQL-native, no third-party dependency, potential standalone product
- Potential open-source play: "Shopify MCP Server by Automatos"

### Phase 3 (post-launch): Custom MCP
- Extend with Automatos-specific tools (agent-aware commerce operations)
- Integrate with Automatos memory + missions for stateful operations
- List on MCP directories for brand awareness

---

## Pricing

| Plan | Widgets | Agents | Interactions/mo | Badge | Price |
|---|---|---|---|---|---|
| Starter | 3 | 2 | 10K | Required | £99/mo |
| Growth | 10 | 5 | 50K | Required | £299/mo |
| Pro | Unlimited | 15 | 250K | Optional | £799/mo |
| Enterprise | Unlimited | Unlimited | Volume | White-label | Custom |

7-day trial. No free tier. Metered on interactions, not widget count.

---

## Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| P1/P2 fixes slip | Medium | Critical | Nothing ships until these land |
| Inbuild owner declines | Low | High | Backup merchant by week 4 |
| Shopify rejects App Store listing | Medium | Medium | Plan for 2 rounds of review feedback |
| Shopify builds multi-agent layer | Medium | High | 90-day speed advantage, deeper context |
| LLM costs explode on busy store | Medium | High | P4 budget governor before paid merchants |
| Composio REST deprecation | Low (Phase 1) | Medium | MCP server ready in Phase 2 |

---

## Reference Documents

| Document | Location |
|---|---|
| North Star Strategy | `docs/SHOPIFY/SHOPIFY-00-NORTH-STAR.md` |
| Inbuild Pilot Plan | `docs/SHOPIFY/SHOPIFY-01-INBUILD-PHASE-1.md` |
| Widget Catalog (20 widgets) | `docs/SHOPIFY/SHOPIFY-02-WIDGET-CATALOG.md` |
| Toolkit Integration | `docs/SHOPIFY/SHOPIFY-03-TOOLKIT-INTEGRATION.md` |
| Wizard Onboarding | `docs/SHOPIFY/SHOPIFY-04-WIZARD-ONBOARDING.md` |
| Competitor Analysis | `docs/SHOPIFY/SHOPIFY-05-COMPETITORS.md` |
| 90-Day Plan | `docs/SHOPIFY/SHOPIFY-06-90-DAY-PLAN.md` |
| LEGO Positioning | `docs/SHOPIFY/SHOPIFY-07-LEGO-POSITIONING.md` |
| Agent Design (why Automatos > Toolkit) | `docs/SHOPIFY/SHOPIFY-AGENT-DESIGN.md` |
| Agent Specs (4 core agents) | `docs/SHOPIFY/SHOPIFY-AGENTS-SPEC.md` |
| Widget Agent Templates | `docs/SHOPIFY/SHOPIFY-WIDGET-AGENTS.md` |
| Merchant Operations Skills | `docs/SHOPIFY/SHOPIFY-MERCHANT-SKILLS.md` |
| Deck Brief (Inbuild pitch) | `docs/SHOPIFY/SHOPIFY-DECK-BRIEF.md` |
| MCP Server Evaluation | `docs/SHOPIFY/SHOPIFY-MCP-EVALUATION.md` |
| This PRD | `docs/SHOPIFY/PRD-SHOPIFY-PLATFORM.md` |
