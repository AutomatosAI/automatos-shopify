# PRD: Product Knowledge Grounding — turning blind agents into informed assistants

**PRD ID:** SHOPIFY-009
**Status:** Draft v0.1 — **PARKED 2026-05-14** until PRD-008-A ships. Layer 1 (enriched page context) is live on orchestrator branch `feat/prd-009-layer-1-grounded-context`. Layers 2–3 (catalog graph + live actions) resume after PRD-008-A is solid. PRD-008-B (cross-sell + bulk pricing) is gated on this PRD's Layer 2.
**Owner:** Gerard
**Date:** 2026-05-14
**Priority:** P1 — without this, every Automatos chatbot feels generic. With it, every Automatos chatbot feels like the merchant's most informed staff member.

**Related work:**
- PRD-007 (Proactive Engagement) — shipped. This PRD makes its openers and conversations factually grounded.
- PRD-008 (Callback + Cart features) — depends on this for cross-sell relevance.
- Companion: `automatos-shopify/docs/PRDS/PRD-007-PROACTIVE-WIDGET-ENGAGEMENT.md`

---

## Why this PRD exists (the client-facing pitch)

A live demo on INBUILD UK on 2026-05-13 produced this proactive opener for a smoke control panel product page:

> *"Looking at the SVM basic panel — most installers ask about zone expansion and actuator compatibility before committing to a system."*

The shopper would think: *"This bot knows building ventilation."* In reality, the agent **made it up**. It had the product title and nothing else — no specs, no compatibility data, no installation context. The text happened to be plausible because the product type ("smoke control") mapped to plausible-sounding installer concerns.

That's a high-wire act. Every demo that lands well is one mistake away from telling a contractor that an EN 12101-9 panel is rated for cold-store applications when it isn't. Once that happens to one merchant, every Automatos conversation becomes legally risky for them.

We need agents that **know** instead of guess.

The good news: Shopify already has all the data. The merchant has spent years curating product specs, variants, vendor information, inventory rules, metafields, certifications. We just need to ingest it once, keep it fresh, and turn it into a knowledge layer the agent reasons over.

**The pitch to clients:** *"Your bot will know every product as well as your most senior team member knows them — because it learns from the same source: your actual catalog, kept fresh in real-time, never invented."*

---

## Goal

Every Automatos chatbot can answer the following truthfully, without making anything up:

1. **Specs of any product the merchant sells** — exact dimensions, ratings, variants, certifications.
2. **Compatibility / "what works with this"** — derived from product types, vendor relationships, metafields, and (if available) order co-occurrence data.
3. **Real-time price + availability** — never stale by more than minutes.
4. **Cross-product reasoning** — "what's the difference between SVM-A and SVM-B", "what do I need if I'm installing in a 4-storey atrium".
5. **Trade vs DIY framing** — using customer tags + product metafields to choose register.

All while costing the merchant nothing extra in latency on the storefront and being trivial for them to set up.

---

## Non-goals

- Not building our own Shopify product editor.
- Not replacing the merchant's PIM if they have one.
- Not enabling the bot to write back to Shopify in this PRD (that's PRD-008's discount + draft-order territory).
- Not doing semantic search of the merchant's marketing copy for SEO purposes (separate need).

---

## The current state and why both naive options fail

INBUILD UK has ~1400 products. We need product knowledge available to the agent. Two options that look obvious **and are both wrong**:

### Option A — Crawl every product page (firecrawl-style)

| Why it sounds right | Why it doesn't work |
|---|---|
| "We just scrape what's already public" | Product pages are rendered HTML. Specs live in metafields and variant attributes that aren't always rendered. |
| | Every Shopify theme renders differently — parsing logic breaks per merchant. |
| | No webhook story → data goes stale immediately. |
| | 1400 page fetches takes hours, hits rate limits, generates noise traffic on the merchant's CDN. |
| | We pay for re-rendering work the merchant already did to populate Shopify. |

### Option B — Round-trip Composio per query

| Why it sounds right | Why it doesn't work |
|---|---|
| "Composio is already wired up" | Every chat message → 800-2000ms added latency before the agent thinks. |
| | Same product gets fetched 100x per day across shoppers — wasteful. |
| | Burns Composio API quota linearly with shopper traffic, not catalog size. |
| | Doesn't enable semantic search ("recommend something similar") — that needs a vector index, not point lookups. |
| | Doesn't survive Composio rate limits at scale (4.6M merchants would saturate any per-merchant quota). |

The right answer combines neither: **ingest once via the structured API, keep fresh via webhooks, build relationships on top.**

---

## Architecture — the three-layer model

```
┌──────────────────────────────────────────────────────────┐
│ Layer 3 — Live actions (Composio)                        │
│   For: order lookups, current inventory levels,          │
│        creating discount codes, cancelling orders        │
│   Latency budget: 200-2000ms (acceptable on demand)      │
│   When: shopper explicitly needs a real-time fact        │
└──────────────────────────────────────────────────────────┘
                             ▲
┌──────────────────────────────────────────────────────────┐
│ Layer 2 — Knowledge graph (the differentiation)          │
│   Per merchant. Built from Shopify data + relationships  │
│   we derive on top.                                      │
│                                                          │
│   - Vector embeddings: semantic search over products     │
│   - Explicit relations: same-vendor, same-type,          │
│     same-collection, frequently-bought-together,         │
│     compatible-with (from metafields)                    │
│   - Cached structured facts: title, type, price, vendor, │
│     variants, certifications                             │
│                                                          │
│   Latency budget: <500ms                                 │
│   When: any "tell me about X" or "what works with X"     │
└──────────────────────────────────────────────────────────┘
                             ▲
┌──────────────────────────────────────────────────────────┐
│ Layer 1 — Page context (already implemented in PRD-007)  │
│   What the shopper is looking at RIGHT NOW.              │
│   Title, type, price, vendor, availability, cart count.  │
│                                                          │
│   Latency budget: 0ms (already in the page DOM)          │
│   When: every interaction                                │
└──────────────────────────────────────────────────────────┘
```

**Each layer answers a different need.** Don't try to make one layer do all three jobs (that's where Options A and B above go wrong).

---

## What changes for the merchant

Nothing visible. They install the app, the catalog starts indexing in the background, the bot becomes informed within 15-30 minutes (for a 1400-product store). After that, every product update they make in Shopify reflects in the bot within seconds.

For the merchant's pitch deck:

> "You curate your product catalog in Shopify like you always do. Automatos reads it once, keeps it fresh in real-time via webhooks, and your AI assistant answers shopper questions using the actual data — not fabricated guesses. The same way Klaviyo and Gorgias keep their email and ticket workflows in sync with your products."

---

## Why bulk sync via Composio / Shopify Bulk Operations beats firecrawl

| | Bulk sync via Composio / Shopify Bulk Op | firecrawl raw HTML |
|---|---|---|
| Data shape | Structured JSONL — variants, metafields, inventory levels, vendor, type, tags, all typed correctly | Raw rendered HTML strings; you re-parse per theme |
| Completeness | Everything Shopify has — including variant SKUs, metafield namespaces, inventory across locations | Whatever the theme chose to render to a shopper |
| Setup per merchant | 0 minutes — single Bulk Operations call kicks off async sync | Hours per merchant tuning the parser to their theme |
| Cost per merchant | Free (Bulk Op API has a separate generous quota) | Compute time + bandwidth, scales with catalog size |
| Freshness story | Webhooks — `products/update` fires within seconds of merchant edit | Re-crawl loop on a schedule, always stale by N hours |
| Per-merchant variance | Zero — every Shopify catalog has the same JSON shape | High — every theme is different |
| Operational risk | Zero — Shopify's stable, supported API | Brittle — theme update can break ingestion silently |
| Trade rep | Standard Shopify-app pattern (Klaviyo, Recharge, Gorgias all do this) | Looks like a scrapy startup hack to merchants |
| Cost at scale | Linear in catalog *mutations*, not catalog size | Linear in `merchants × catalog × refresh_frequency` |

**One sentence:** Composio/Bulk gives you typed, fresh, complete catalog data designed for exactly this; firecrawl gives you screenshot-grade strings that pretend to be data.

---

## Implementation phases

### Phase 1 — Layer 1 quick win ✅ shipped 2026-05-14

The agent's proactive openers were missing 80% of the page context the SDK was already collecting. Orchestrator's `_build_proactive_opener_message` now forwards the full populated `pageContext` (title, type, vendor, price, availability, currency, cart count, etc.) and instructs the agent explicitly **not to invent facts the context doesn't include**.

**Effort:** 1 hour. Effect: agent stops guessing about basic facts of the current product. Foundation for asking "is the agent hallucinating something it could have known?" → "no, the right context was passed to it".

### Phase 2 — Layer 2: bulk sync + knowledge graph (this PRD's main body)

**A. Initial sync per merchant**

- New endpoint: `POST /api/shopify/sync/products/start`
  - Triggered automatically on workspace provision after the Composio connection is `ACTIVE`
  - Submits a single Shopify Bulk Operations GraphQL query for products + variants + metafields + inventory levels
  - Records sync state in `workspace.settings.product_sync = { status: "running", bulk_op_id, started_at }`
- Webhook receiver: `POST /api/shopify/sync/bulk-complete`
  - Fires when Shopify finishes generating the JSONL file
  - Downloads the JSONL from Shopify's signed URL
  - Streams into the workspace ingestion pipeline (chunk → embed → store)
- Status endpoint: `GET /api/shopify/sync/status`
  - For dashboard display: % complete, products indexed, last sync time

**B. Webhook subscriptions for incremental updates**

Add to the per-merchant `shopify.app.<merchant>.toml`:

```toml
[[webhooks.subscriptions]]
topics = ["products/create", "products/update", "products/delete"]
uri = "/webhooks/shopify/products"

[[webhooks.subscriptions]]
topics = ["inventory_levels/update"]
uri = "/webhooks/shopify/inventory"

[[webhooks.subscriptions]]
topics = ["collections/create", "collections/update", "collections/delete"]
uri = "/webhooks/shopify/collections"
```

Each event triggers an incremental update to the knowledge graph (single-product re-embed, relation refresh, inventory cache update).

**C. Knowledge graph schema**

Per workspace, in pgvector or a managed vector store (decision in §"Open questions"):

```
nodes:
  Product { id, shopify_product_id, title, handle, type, vendor,
            description_text, embedding[1536], price, available }
  Variant { id, shopify_variant_id, product_id, sku, title,
            options{}, price, inventory_quantity, embedding[1536] }
  Collection { id, shopify_collection_id, title, handle }
  Vendor { id, name }
  Metafield { id, namespace, key, value, owner_type, owner_id }

edges (typed, weighted):
  PRODUCT_IN_COLLECTION    (Product → Collection)
  PRODUCT_BY_VENDOR        (Product → Vendor)
  VARIANT_OF               (Variant → Product)
  SAME_TYPE                (Product → Product, derived)
  SAME_VENDOR              (Product → Product, derived)
  FREQUENTLY_BOUGHT_WITH   (Product → Product, derived from orders if synced)
  COMPATIBLE_WITH          (Product → Product, derived from metafields if merchant tagged)
  REPLACES                 (Product → Product, derived from product_type + dimension match)
```

**D. Skill update — `shopify-support` and `shopify-product-expert`**

Both skills get a new "knowledge ground rules" section:

```
## Knowledge ground rules

Before answering any product question:
1. Query the workspace knowledge graph for the product (graph_query tool)
2. If the graph has the answer, use it verbatim — do not paraphrase specs
3. If the graph has partial info, say what you know and offer to check the rest
4. If the graph has nothing, ASK rather than fabricate
5. NEVER invent dimensions, certifications, ratings, or compatibility claims

For "what works with this" questions, traverse the graph:
- Same-collection products
- Same-vendor products
- Products linked via COMPATIBLE_WITH metafields
- (Optionally) products co-bought in the last 90 days
```

**Effort estimate:** ~10-15 days across orchestrator + ingestion pipeline + skill updates + dashboard sync-status display.

### Phase 3 — Layer 3 polish

Composio is already wired. Just need:
- Standardised tool routing in the agent so it knows when to reach for live tools vs the knowledge graph
- Caching of frequently-fetched live data (e.g. order status for active orders) to dampen Composio rate-limit pressure

**Effort:** 2-3 days.

---

## Cost analysis

### Per merchant (e.g. INBUILD UK, 1400 products)

| Item | One-off | Ongoing |
|---|---|---|
| Bulk sync API call | $0 (free tier) | $0 |
| Initial embedding (1400 products × ~500 tokens each, OpenAI ada-002) | ~$0.14 | — |
| Vector storage (1400 × 1536 floats × 4 bytes ≈ 8 MB) | $0 | <$0.01/mo |
| Webhook processing | — | <$0.10/mo (mostly idle) |
| Re-embedding on updates (~10 product edits/day average) | — | ~$0.01/mo |

**Total per merchant: < $0.50 lifetime to date, < $0.20/mo ongoing.**

### At scale (4.6M merchants)

| Resource | Calculation | Estimate |
|---|---|---|
| Vector storage | 4.6M × 8 MB avg | ~37 TB → managed pgvector or Qdrant cluster: $3-5K/mo |
| Bulk sync compute | Async workers; not user-facing latency | 1 medium worker per ~1000 active merchants: ~$2K/mo at scale |
| Webhook intake | Linear in mutations not queries; batch | <$1K/mo for the first 100K active merchants |
| Embedding cost | Mostly one-off + small deltas; bulk pricing | ~$0.10 amortised per merchant |

**Order of magnitude: $10-15K/mo infra cost for serving 4.6M Shopify merchants** (back-of-envelope; assumes long-tail with most merchants having <500 products). Trivial vs the per-merchant value.

---

## What we get over the competition

Most Shopify chatbot apps (Tidio, Crisp, Gorgias chat) operate at Layer 1 only — they read the page, parrot it back. None of them build a real knowledge graph per merchant. None of them have semantic recommendation across a merchant's catalog without manual rule tagging.

| Capability | Tidio | Gorgias | Klaviyo | **Automatos with PRD-009** |
|---|---|---|---|---|
| Reads current product page | ✅ | ✅ | ✅ | ✅ |
| Bulk product sync | ❌ | ❌ | ✅ (for emails) | ✅ |
| Per-product vector embeddings | ❌ | ❌ | ❌ | ✅ |
| Semantic product recommendations from catalog | ❌ (curated rules only) | ❌ | ❌ | ✅ |
| Compatibility / "what works with this" reasoning | ❌ | ❌ | ❌ | ✅ |
| Ground-truthed agent (no hallucination) | n/a (no agent) | n/a | n/a | ✅ |
| Real-time freshness via webhooks | n/a | ✅ | ✅ | ✅ |

**The pitch:** Automatos is the only Shopify AI assistant that *learns the merchant's catalog* instead of *reading whichever page is open right now*.

---

## Acceptance criteria — what "done" looks like for INBUILD UK

| Check | Pass condition | How to verify |
|---|---|---|
| Initial sync completes after install | All 1400 products + variants + metafields present in workspace KG within 30 min of provision | Sync status endpoint returns `complete` |
| Webhook updates apply within 60s | Edit a product in Shopify; ask the bot about it 60s later; bot reflects the new info | Manual test |
| Bot stops fabricating specs | Ask "what's the height of the SVM panel" — bot gives the actual height OR says "I don't have that — I can ask the team" | 10-test diagnostic battery |
| Cross-product reasoning works | Ask "what actuators work with the SVM panel" — bot returns specific products it has linked, not generic platitudes | Manual test |
| Latency budget honoured | Median agent response time stays under 4s end-to-end | DevTools timing measurement |
| Merchant zero-config | Merchant doesn't set anything up beyond installing the app + ticking proactive popups | Re-test the install flow on a fresh test store |

---

## Open questions

| # | Question | Owner | Default if unanswered |
|---|---|---|---|
| 1 | Vector store: pgvector (free, runs alongside orchestrator Postgres) vs Qdrant (purpose-built, scales better)? | Engineering | pgvector for v1; revisit at 100K merchants |
| 2 | Embedding model: OpenAI ada-002 vs open-source (e.g. bge-small)? | Engineering | OpenAI ada-002 for v1; cost is negligible |
| 3 | Should we sync ORDER data for "frequently bought together"? | Product + privacy | Defer to v2 — adds complexity, GDPR considerations |
| 4 | How do we handle merchants with 50K+ products (e.g. dropshippers)? | Engineering | Bulk sync handles it; vector store cost goes up linearly. Possibly tier "starter" at 10K product cap. |
| 5 | Should the merchant see a sync-progress UI in the dashboard? | Product | Yes — minimal status badge in the dashboard's workspace overview |
| 6 | What's the SLA for webhook freshness? | Product | "Within 60 seconds" — under the chat response budget |
| 7 | Re-embed strategy for product description updates: full re-embed vs delta? | Engineering | Full re-embed per product; cost is negligible |

---

## Risks

| Risk | Mitigation |
|---|---|
| Shopify Bulk Op delivers stale data on initial sync (rare timing issue) | First webhook event after sync triggers a single-product refresh |
| Vector store doesn't scale to 4.6M merchants on pgvector | Hard pivot to Qdrant or Milvus before that scale; design schema today to be store-agnostic |
| LLM still hallucinates despite grounding | Add explicit "do not invent" instructions in skill prompts (already in PRD-007 v0.4); periodic eval suite |
| Webhook delivery fails during merchant outage | Periodic reconciliation cron — every 24h, run a delta sync against Shopify to catch dropped webhooks |
| Merchant deletes Composio connection | Sync stops cleanly; existing KG remains until manual purge or 90-day stale-data cleanup |
| Embedding cost spikes for very large catalogs | Per-merchant tier: free up to N products, paid above that. Aligns cost with merchant value. |

---

## Cross-references

- Source for the architecture: industry standard for Shopify SaaS apps (Klaviyo, Recharge, Gorgias all do bulk + webhook)
- Shopify Bulk Operations API: https://shopify.dev/docs/api/usage/bulk-operations/queries
- Shopify Webhook topics: https://shopify.dev/docs/api/admin-rest/2024-04/resources/webhook
- Composio Shopify toolkit: 394 tools available, see `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md`
- Phase 1 fix: orchestrator/api/widgets/chat.py `_build_proactive_opener_message`
- Skill updates needed: `automatos-skills/shopify/shopify-support/SKILL.md`, `shopify-product-expert/SKILL.md`
