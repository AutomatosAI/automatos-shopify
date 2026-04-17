# Inbuild UK — Phase 1 Pilot

**Status:** Research / pilot plan
**Owner:** Gerard
**Merchant:** Inbuild UK (real Shopify store, friend of Gerard)
**Date:** 2026-04-12

---

## Mission

Make Inbuild UK "the most AI-powered Shopify store on the planet" — real widgets, real agents, real receipts. Use it as the anchor case study for the Automatos Shopify App Store launch, then productize the pattern for every future merchant.

The half-joke: make it so valuable the owner could sell the store itself as an "AI-powered business."
The serious part: every screenshot, video clip, and metric from Inbuild becomes a Shopify App Store listing asset and a sales enablement artefact.

---

## Why Inbuild

- Real merchant. Real traffic. Real catalog. Real customers.
- Friend relationship means we can iterate fast, break things, fix them, without losing the account.
- No App Store review gating — we can test anything on the live store before we commit to a listing.
- Vertical is product/construction adjacent, not fashion or beauty — demonstrates Automatos is not niche.
- Small enough to matter to the owner, large enough that results are meaningful.

---

## The Inbuild "AI-powered storefront" vision

Every touchpoint on the Inbuild storefront and admin is backed by an Automatos agent. Shoppers experience an intelligent store that answers questions, recommends products, handles returns, and surfaces the right content. Merchants experience a dashboard where the store essentially runs itself — the owner sees daily briefs, inventory alerts, and done-for-you content.

The goal: on a 1-hour walkthrough video, the viewer says "why doesn't every Shopify store work like this?" and the answer is "because only Automatos can do this today."

---

## Widgets to deploy on Inbuild (pilot slate)

Target: **6-8 widgets live within 90 days**. Each widget powered by a dedicated agent.

### Storefront (shopper-facing)
| # | Widget | Agent | Purpose |
|---|---|---|---|
| 1 | **Chat FAB** | Inbuild Support Agent | Pre-sales questions, delivery, returns, sizing |
| 2 | **Product Q&A (inline on PDP)** | Product Expert Agent | Answers from spec sheets + reviews + description |
| 3 | **Conversational shopper** | Merchandising Agent | "I need X for Y" → catalog search + recommendations |
| 4 | **Review summarizer** | Review Analyst Agent | Plain-English pros/cons from all reviews on a PDP |
| 5 | **Gift finder quiz** | Gift Concierge Agent | 5-question quiz → personalized shortlist |
| 6 | **Blog widget (`/blog`)** | SEO/Content Agent | Auto-published posts on heartbeat, weekly |

### Admin (merchant-facing)
| # | Widget | Agent | Purpose |
|---|---|---|---|
| 7 | **Daily business brief** | Business Analyst Agent | Morning brief on sales, traffic, inventory, ad spend |
| 8 | **Inventory watchdog** | Inventory Agent | Stockout alerts, reorder suggestions, slow-mover flags |

### Stretch (if time permits)
- **Abandoned cart save-the-sale** — on exit intent, agent asks why and offers relevant incentive
- **SEO metadata injector** — agent rewrites meta tags + JSON-LD schema per page
- **FAQ auto-generator** — pulls top support tickets, generates answers, publishes as FAQ block

---

## Agent roster Inbuild needs

All agents seeded via the Mission Zero wizard on first run, refined over the pilot period.

| Agent | Role | Skills | Tools | Memory |
|---|---|---|---|---|
| Inbuild Support | Shopper questions | shopify_support, returns, order_status | Shopify Admin API (order lookup, refund init), knowledge base search | Conversation memory, policy memory |
| Product Expert | PDP answers | catalog_expert, spec_lookup | Catalog RAG, review RAG | Per-SKU memory |
| Merchandising | Shopper recommendations | merchandiser, cross_sell | Catalog vector search, purchase history | Customer segment memory |
| Review Analyst | Review synthesis | review_summarizer | Review fetch, sentiment analysis | Per-SKU review memory |
| Gift Concierge | Gift discovery | conversational_shopper, gift_matcher | Catalog search, quiz state | Session memory |
| SEO/Content | Blog posts, SEO | seo_writer, keyword_research, content_planner | Web search, competitor scrape, Shopify Blog API | Content history, brand voice memory |
| Business Analyst | Daily briefs | business_analyst, financial_summary | Shopify Admin API (sales, traffic), Meta/Google Ads API | Historical metrics memory |
| Inventory | Stock management | inventory_manager, reorder_logic | Shopify Admin API (inventory), supplier data | Lead time memory, seasonal memory |

All 8 agents report to a top-level **Inbuild Mission Lead** coordinator agent. Org chart stored in `agents.reports_to_id` (already supported).

---

## The "receipts" we need to capture

For each widget deployed on Inbuild, capture:

1. **Before / after screenshots** — the store page without widget, then with
2. **Video clip** — 10-30 seconds showing the widget working with real data
3. **Metric impact** — conversion lift, support deflection, time saved, revenue uplift (even directional)
4. **Merchant quote** — 1-2 sentences from the owner on what it changed for them
5. **Agent log extract** — screenshot of the backend showing real agent work (reports, memories, tool calls)

These become:
- Shopify App Store listing screenshots
- Sales enablement deck
- Landing page hero section
- Launch video for the App Store listing
- Twitter / LinkedIn launch thread content
- Investor update material

---

## Timeline

| Week | Focus | Deliverable |
|---|---|---|
| 1 | P1/P2 platform fixes + Inbuild Mission Zero seed | Durable wizard, per-intake workspace, 8 seeded agents |
| 2 | Chat FAB + Product Q&A widgets live on Inbuild | 2 widgets shipping real value |
| 3 | Blog widget + SEO content agent ships first 3 posts | Agent-authored blog live at /blog |
| 4 | Daily business brief + Inventory watchdog in Inbuild admin | Merchant-facing widgets live |
| 5 | Review summarizer + Gift finder widgets | 6 widgets live, halfway to goal |
| 6-8 | Iteration based on real Inbuild usage, metric capture | Receipts captured, case study drafted |
| 9-10 | Case study write-up + video production | Launch assets ready |
| 11-12 | Shopify App Store submission + marketing push | Listing live |

---

## Success criteria

- [ ] 6+ widgets live on Inbuild by end of week 6
- [ ] Each widget has a dedicated Automatos agent running autonomously via heartbeat
- [ ] Measurable metric impact captured for at least 3 widgets (conversion, deflection, or revenue)
- [ ] 1-hour walkthrough video produced
- [ ] Owner testimonial recorded
- [ ] Case study document published to automatos.app
- [ ] Shopify App Store listing uses Inbuild as primary proof
- [ ] 100% of "Powered by Automatos" footer badges live and clickable on Inbuild storefront

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Widget breaks Inbuild theme on mobile | Shadow DOM isolation protects against most theme conflicts; test on real theme before merging |
| Shopper thinks AI response is wrong, damages brand | Advisory mode first — agents suggest, humans approve, transition to autonomous after trust is built |
| LLM cost explodes on a busy day | Budget governor hard-stop (P4 fix) must land before scale |
| Inbuild owner loses patience if Week 1-2 break | Set expectations explicitly: "this is our pilot, we iterate daily" |
| P1 (durable wizard) not fixed in time | Do not deploy to Inbuild until durable pipeline is live — fire-and-forget pipeline in front of a real merchant is a brand-kill risk |
| **Blog widget XSS via innerHTML** | PostDetail uses raw `innerHTML` for blog content, relying on backend bleach. Add client-side DOMPurify before Inbuild deploy — one backend config drift = XSS in the store. P0 SDK fix. |
| **GDPR violation from sessionStorage** | AuthManager writes session tokens without checking Shopify privacy API (`window.Shopify.customerPrivacy`). Must check consent before any storage write. P0 SDK fix. |
| **SSE stream drops on mobile** | No reconnection logic in the SSE parser. Shoppers on flaky mobile connections get dead chat with no recovery. Add reconnection by week 5. |
| **No backup merchant** | If Inbuild falls through, the entire strategy loses its anchor. Identify a backup friendly merchant by week 4. |
| **Shopify section re-render destroys widgets** | Shopify's AJAX section rendering API can destroy and re-render sections. Blog widget mounted inside a section gets wiped. Need MutationObserver or reinit hook. |

---

## The "sell the store" joke, seriously

The half-joke about selling Inbuild as an "AI-powered business" is actually a real productization path:

- Automatos becomes the layer that makes any Shopify store more valuable as an asset
- "AI-powered Shopify store" becomes a sellable business category on Flippa, Empire Flippers, etc.
- Automatos could partner with Shopify store marketplaces to tag listings as "Automatos-enabled"
- Buyers pay a premium for stores that run themselves

Not Phase 1 work, but worth noting — the Inbuild experiment is the proof that this category exists.
