# PRD: Callback Handoff + Cart-Page Engagement (Features B, C1, C2, C3)

> ## ⚠ THIS PRD HAS BEEN SPLIT (2026-05-14)
>
> The INBUILD-UK-centric framing in this doc has been replaced by two cleaner PRDs after re-scoping for 4.6M-merchant reach:
>
> - **Features B (Callback) + C1 (Cart-idle)** → moved to `PRD-008-A-HUMAN-HANDOFF-AND-SITES.md`. These are universal across any Site type (Shopify, Wix, custom embed) and have no PRD-009 dependency. **Active build.**
> - **Features C2 (Cross-sell) + C3 (Bulk pricing)** → **deferred as PRD-008-B**. Both require the catalog knowledge graph from PRD-009 Layer 2 to avoid fabrication. Re-scoped after PRD-008-A ships.
>
> This original doc is retained for traceability — the `[OPEN]` items, story 3+4, the cross_sell/bulk_pricing configuration block, and the C2/C3 risks/acceptance criteria are the seed material for PRD-008-B when work resumes.

**PRD ID:** SHOPIFY-008 (parent, split)
**Status:** Superseded by PRD-008-A (active) + PRD-008-B (deferred). Kept for traceability.
**Owner:** Gerard
**Date:** 2026-05-12 (v0.1) → 2026-05-14 (split notice)
**Priority:** N/A (split)

**Source discovery:** `docs/SHOPIFY/CLIENT-DISCOVERY-INBUILDUK.md` §2a (Features B + C1 + C2 + C3)
**Hard dependency:** PRD-007 must land first — this PRD relies on the proactive engine, page-context plumbing, and `widget_proactive` workspace config it introduces.
**Sibling PRDs (related but out of scope):** Email-channel cart abandonment recovery (after-shopper-leaves) — needs Shopify email flow + email connector, not in this PRD.

---

## Problem

PRD-007 makes the widget context-aware on product pages, but leaves three real merchant asks unaddressed:

1. **Shoppers who want a human can't easily reach one.** The current bot has no structured handoff — it can suggest "contact us" but cannot capture a callback request and route it anywhere. INBUILD UK's tech-support team has limited capacity; pretending they're always available is dishonest.
2. **The `/cart` page is a missed engagement surface.** Shoppers arrive at the cart with intent but often abandon — the bot does nothing today. PRD-007 only fires on product pages.
3. **Bulk-buy intent is invisible to the bot.** INBUILD UK serves trade contractors who frequently buy in volume. The bot has no awareness of bulk-discount thresholds and can't proactively surface offers, even though `shopify-supplier-management` skill knows how to think about them.

Together these are the gap between "page-aware chatbot" and "assistant that converts."

---

## Goal

Four sub-features layered on top of PRD-007:

- **B. Callback handoff** — shopper requests a phone callback; bot captures phone + name + product context + urgency; payload lands in a merchant-nominated destination; bot manages expectations honestly.
- **C1. Cart abandonment recapture (on-site)** — shopper has items in cart but stalls; bot proactively offers help while they're still on the site.
- **C2. Cart-page cross-sell** — shopper lands on `/cart`; bot suggests complementary products from a configured source.
- **C3. Bulk pricing offers** — shopper viewing a product or cart eligible for bulk thresholds; bot mentions the threshold + offer.

All four configurable per workspace; defaults OFF; merchant opts in.

---

## Architectural principle (inherits from PRD-007)

Same split: **Shopify-side** owns *when* (triggers, capture UI), **Automatos-side** owns *what* (recommendations, persona text, payload routing). PRD-008 extends both layers without changing the contract.

| Sub-feature | Shopify-side adds | Automatos-side adds |
|---|---|---|
| B. Callback | Phone-capture form UI inside chat; cart/product context already in `pageContext` from PRD-007 | Webhook receiver `POST /api/widgets/callback`; per-workspace destination config; queueing if destination is async |
| C1. Cart-abandon | Trigger registered on `/cart`: `idle_on_cart` (e.g. 90s without checkout-click) | Reuses PRD-007 opener engine; new prompt template for "shopper-on-cart-not-progressing" |
| C2. Cart cross-sell | Fires on `/cart` load (no extra trigger needed); passes cart line-item list | New tool `recommend_cross_sells`; reads from configured source (Composio related-products / curated table / RAG) |
| C3. Bulk pricing | Reads volume-discount metadata from product/cart context | Skill awareness already present in `shopify-supplier-management`; new tool `lookup_bulk_threshold` (reads Shopify discount rules) |

---

## Success Criteria

| Check | Pass condition | Measurement |
|---|---|---|
| Bot can capture a callback request | Shopper enters phone, the request reaches the configured destination, transcript includes the structured payload | End-to-end manual test against test inbox / Slack channel |
| Bot honestly manages expectations | Outside-hours phrasing differs from in-hours; SLA phrasing reflects merchant config | Manual test at 11pm UK time vs 11am |
| Cart-abandon trigger fires only on `/cart` | No fire on product / collection / home; only after configured idle threshold | Devtools timing check |
| Cross-sell on cart shows relevant products | Suggestions match cart contents (e.g. actuator → control panel); price + image render | Visual check on 3 different cart compositions |
| Bulk threshold surfaced when applicable | If cart line is within 10% of a bulk threshold, bot mentions the offer | Test cart line at 9/10 units (10 = threshold), verify mention |
| All four sub-features default OFF | Newly provisioned workspace doesn't fire any of B/C1/C2/C3 until merchant enables | Smoke test on fresh dev workspace |
| No regression on PRD-007 product-page flow | Product-page proactive popup still works exactly as today | Smoke test on 1lovefragrance |
| Cookie consent respected on cart-page popups | If `respect_consent = true`, popup suppressed when marketing consent declined | Manual GDPR-mode test |

---

## Scope

### In scope

**Feature B — Callback handoff:**
- Chat-side phone-capture form (triggered by intent classifier on phrases like "speak to someone", "call me back", or a UI button the bot surfaces).
- Required fields: phone (E.164 validated), name. Optional: product of interest (auto-filled from `pageContext`), urgency, preferred callback time window.
- `POST /api/widgets/callback` orchestrator endpoint.
- Per-workspace destination config: one of `email | slack_webhook | shopify_customer_note | crm_webhook`. Multiple destinations possible (e.g. email + Slack).
- Out-of-hours messaging — if `working_hours_only = true` and current time outside the configured window, bot quotes the SLA differently ("our team is back at 8am tomorrow — we'll call you then").
- Capacity-aware phrasing: if `team_capacity = limited`, bot frames the callback as "we'll *aim* to call" rather than "we *will* call."

**Feature C1 — Cart abandonment recapture (on-site):**
- New trigger type `idle_on_cart` configurable seconds (default 90s).
- Fires only on `/cart` page.
- Greeting variant: cart-aware ("You've got {N} items in your cart — anything I can help with before checkout?").
- Same frequency cap + dismissal logic as PRD-007.

**Feature C2 — Cart-page cross-sell:**
- `/cart` page-type added to `widget_proactive.page_types` whitelist.
- New trigger `cart_page_loaded` (fires once per `/cart` visit, after configurable delay e.g. 8s).
- Recommendation source config: `composio_related | curated | rag_catalog` — merchant chooses.
- Suggestions presented as inline chat message with up to 3 product cards (title, image, price, "view product" link).

**Feature C3 — Bulk pricing offers:**
- Read Shopify volume-discount metadata via Composio (`SHOPIFY_LIST_PRICE_RULES`, `SHOPIFY_LIST_DISCOUNTS`) on session init; cache for 5 min per workspace.
- Mention threshold proactively when:
  - On a product page where bulk discount applies, **and** shopper has shown intent (e.g. added to cart, increased quantity).
  - On `/cart` where current line qty is within 10% of next threshold.
- Phrasing template: "Did you know? {N} more units gets you {%} off."

### Out of scope (defer)

- **Email-channel cart abandonment recovery** (after shopper closes the tab) — needs Shopify email flow integration + email connector; separate PRD.
- **SMS callback notifications to merchant team** — phone is captured, but merchant-side notification UX is not built. Destination is one of the configured types only.
- **CRM-specific deep integrations** (HubSpot, Salesforce, Pipedrive native connectors) — generic webhook only in v1; merchant wires it themselves.
- **Server-driven cross-sell scoring** (RFM segmentation, shopper-history-based suggestions) — anonymous-session cross-sell only.
- **A/B testing of callback prompts or cross-sell phrasing** — single variant in v1.
- **Multi-step bulk-discount tiers in a single popup** — v1 mentions only the next threshold, not the full ladder.
- **Auto-applying discounts** — bot mentions, doesn't apply. Merchant configures Shopify-side rules.

---

## User stories

### Story 1 — Callback request, in-hours
> *As a contractor browsing an EN 12101-9 panel during business hours, I ask the bot "can someone phone me about this?" The bot asks for my name + phone + best time. I enter them. The bot confirms: "Thanks James — we'll aim to call you within 2 working hours about the EN 12101-9 panel." The request lands in INBUILD UK's shared inbox + Slack #sales channel with product context attached.*

### Story 2 — Callback request, after-hours
> *Same contractor, 11pm. Bot says: "Our team's offline now — they're back at 8am. I've logged your details and they'll call you first thing. Anything else I can help with tonight?"*

### Story 3 — Cart-abandon nudge
> *Shopper has 2 items in cart, has been on `/cart` for 90 seconds without clicking Checkout. Bot pops: "Need any help finishing your order, or have questions about delivery times?" Shopper either clicks to ask, or dismisses (no re-pop this session).*

### Story 4 — Cart cross-sell
> *Shopper on `/cart` with an actuator in their cart. 8 seconds after page load, bot shows: "Most installers also fit this control panel with that actuator — [Product Card]. Want details?" Shopper can click into the product or dismiss.*

### Story 5 — Bulk threshold nudge
> *Trade shopper viewing a louvre vent product, adds 9 units to cart. Bot pops on cart page: "Heads up — 10 units gets you 8% off the line. Worth bumping by one?" Shopper either adjusts or dismisses.*

### Story 6 — All four off by default
> *Newly provisioned merchant: chat icon is silent. Merchant enables Feature B + C2 only in dashboard. C1 and C3 stay dormant. Storefront reflects the choice within 30s of save.*

---

## Configuration model (extends PRD-007's `widget_proactive`)

```jsonc
{
  "widget_proactive": {
    // ...PRD-007 fields unchanged...
    "page_types": ["product", "cart"],            // PRD-008 adds "cart"
    "triggers": [
      { "type": "time_on_page", "seconds": 20 },  // PRD-007 default
      { "type": "idle_on_cart", "seconds": 90 },  // PRD-008 C1
      { "type": "cart_page_loaded", "delay_seconds": 8 }  // PRD-008 C2
    ]
  },
  "callback": {                                     // PRD-008 Feature B
    "enabled": false,
    "destinations": [
      { "type": "email", "address": "sales@inbuilduk.com" }
      // also supported: { "type": "slack_webhook", "url": "https://hooks.slack.com/..." }
      //                 { "type": "crm_webhook", "url": "https://...", "auth_header": "..." }
      //                 { "type": "shopify_customer_note" }
    ],
    "fields": {
      "phone_required": true,
      "name_required": true,
      "urgency_optional": true,
      "preferred_time_optional": true
    },
    "working_hours_only": true,
    "working_hours": {
      "tz": "Europe/London",
      "monday_to_friday": { "start": "08:00", "end": "17:30" },
      "weekends": "closed"
    },
    "sla_phrase_in_hours": "We'll aim to call you within 2 working hours",
    "sla_phrase_out_of_hours": "We'll call you first thing the next working day",
    "team_capacity": "limited",                    // "limited" softens phrasing
    "intent_phrases": [                            // trigger callback flow
      "speak to someone", "call me back", "talk to a human", "phone me", "tech support"
    ]
  },
  "cross_sell": {                                   // PRD-008 Feature C2
    "enabled": false,
    "source": "composio_related",                  // composio_related | curated | rag_catalog
    "max_suggestions": 3,
    "curated_rules": []                             // [{ if_product_id: "...", suggest: [...] }]
  },
  "bulk_pricing": {                                 // PRD-008 Feature C3
    "enabled": false,
    "threshold_proximity_pct": 10,                  // mention when within 10% of next tier
    "respect_existing_discount_codes": true         // don't reveal if Shopify rules forbid
  }
}
```

---

## Implementation plan

### 1. Widget runtime (`automatos-widget-sdk`)

**Files:** `packages/loader/src/**`, `packages/chat-widget/src/**`

- New trigger types: `idle_on_cart`, `cart_page_loaded` — register alongside PRD-007's `time_on_page` etc.
- Chat-widget UI extension: callback form component (phone + name + optional fields) — toggled on by intent classifier or "request callback" CTA.
- Cart-page-aware mode: read `cart_*` data attrs from chat-widget block; pass cart line items in chat payload.
- Recommendation card component (product image + title + price + view link) for C2 suggestions inline.

**Effort:** 3–4 days.

### 2. Theme extension (`automatos-shopify`)

**Files:** `extensions/automatos-theme/blocks/chat-widget.liquid`

- Already exposes `cart-item-count` from PRD-007 work (2026-05-12).
- Add `cart-total-price` + cart line-items JSON for cross-sell context — Liquid can render `cart.items` as JSON via `{{ cart.items | json | escape }}`.
- No new schema fields — config stays dashboard-side.

**Effort:** 0.5 day.

### 3. Orchestrator (`automatos-ai`)

**Files:** `orchestrator/api/widgets/`, `orchestrator/api/widgets/callback.py` (new), `orchestrator/core/models/workspaces.py`, `orchestrator/services/notifications.py` (new — pluggable destination senders)

- New `POST /api/widgets/callback` endpoint:
  - Validates phone (E.164), name.
  - Fetches workspace `callback` config; resolves destination(s).
  - Dispatches to each destination (email via SES/sendgrid, Slack webhook, Shopify customer note, generic CRM webhook).
  - Returns `{ accepted: true, eta_phrase: "..." }` so the bot can quote the SLA correctly.
- Extend `workspace.settings` schema for `callback`, `cross_sell`, `bulk_pricing` blocks.
- Skill update for `shopify-merchandiser` (cross-sell): new tool `recommend_cross_sells(cart_items, source, max_n)`.
- Skill update for `shopify-supplier-management` (bulk): new tool `lookup_bulk_threshold(product_id, current_qty)`.
- Skill update for `shopify-support` (callback): handle the new `callback_intent` event from widget; orchestrate the capture flow.

**Effort:** 3–4 days.

### 4. Automatos dashboard UI (`automatos-ai`)

**Files:** `frontend/components/workspace/WidgetSettings.tsx`, new `frontend/components/workspace/CallbackSettings.tsx`, `CrossSellSettings.tsx`, `BulkPricingSettings.tsx`

- New panels under Widget Settings, each with its own toggle + sub-config form.
- Callback destinations: dynamic list (add/remove rows), each typed (email | slack | crm | shopify_note).
- Working-hours editor (timezone picker + per-day open/closed/range).
- Cross-sell source dropdown + curated-rules table.
- Bulk-pricing knobs (threshold proximity %, respect existing discount toggle).

**Effort:** 2 days.

### Total

~9 days for v1 across the four codebases. PRD-007 must be live first.

---

## Open questions (blocking before each sub-feature)

### Feature B (callback)
- **B1 — Destination.** Email? Slack? Shopify customer note? CRM? INBUILD UK has not yet nominated one. `[OPEN — discovery follow-up #2]`
- **B2 — Working hours.** What hours? What timezone (assume Europe/London for INBUILD UK)? `[OPEN — discovery follow-up #3 part 1]`
- **B3 — SLA phrasing + capacity safety valve.** "Within 2 working hours"? "End of next business day"? What does the bot say if the team is genuinely too busy? `[OPEN — discovery follow-up #3 part 2]`
- **B4 — Fields captured.** Just phone + name? Also urgency, preferred time, product (auto), email? `[OPEN]`

### Feature C1 (cart-abandon recapture)
- **C1.a — Idle threshold.** 60s? 90s? 120s? `[OPEN]`
- **C1.b — Greeting tone.** "Need help?" vs "Anything stopping you from checking out?" vs a curiosity question. `[OPEN]`

### Feature C2 (cross-sell)
- **C2.a — Recommendation source.** Composio related products / curated pairings / RAG over catalog? `[OPEN — discovery follow-up #5]`
- **C2.b — In-chat vs separate widget.** Cards inside the chat conversation or a separate "you might also need" widget pinned to the cart sidebar? `[OPEN]`
- **C2.c — Max suggestions.** 1, 2, 3? PRD default: 3. `[OPEN — confirmation]`

### Feature C3 (bulk pricing)
- **C3.a — Does INBUILD UK have bulk pricing in Shopify today?** If no → this is gated on them configuring it first. `[OPEN — discovery follow-up #4]`
- **C3.b — Are bulk discounts automatic or code-based?** Affects how the bot phrases the offer. `[OPEN]`
- **C3.c — Phrasing tone.** "Heads up, 10 units gets 8% off" vs "FYI bulk pricing kicks in at 10". `[OPEN]`

---

## Risks

| Risk | Mitigation |
|---|---|
| Callback handoff over-promises and team can't keep up | `team_capacity: limited` softens phrasing; SLA defaults to "aim to" not "will"; merchant has to actively turn this on. |
| Callback destination misconfigured → requests lost | Endpoint returns 4xx on missing destination; dashboard surfaces an "ACTIVE — last delivery succeeded" badge per destination. |
| Cart-abandon trigger annoys repeat shoppers who always pause | Frequency cap inherited from PRD-007 (session scope, max 1). Add per-session-per-cart cap. |
| Cross-sell suggestions are irrelevant (e.g. fan suggested when buying a panel) | Source defaults to `composio_related` (Shopify-derived) before going RAG; curated rules override; bot has explicit "never recommend" list per workspace. |
| Bulk-pricing mention reveals discount the merchant didn't intend to surface | `respect_existing_discount_codes: true` means we don't quote discounts behind a code unless merchant flips it. Always read from configured rules, never invent. |
| Phone number stored — GDPR / data retention | Phone written to merchant destination only; NOT persisted in Automatos beyond the conversation transcript (encrypted at rest, redacted in widget admin views). Configurable retention. |
| Bulk threshold cached too long → stale | 5-min TTL on the workspace-level discount cache; invalidate on `discounts/create` and `price_rules/update` webhooks. |

---

## What this PRD does NOT decide

- **Email-channel cart-abandonment recovery** (post-departure email flow). Separate PRD.
- **Server-driven personalization based on shopper history.** Anonymous sessions only.
- **A/B variants for callback/cross-sell phrasing.** v1 ships single variant.
- **Multi-tier discount ladder in a single popup.** v1 mentions next threshold only.
- **Auto-applying discounts.** Bot mentions; never applies.

---

## Acceptance plan for INBUILD UK

After merchant has answered the `[OPEN]` items above (especially B1, B2, B3, C2.a, C3.a):

1. Update workspace config with their chosen destinations + hours + source.
2. Verify on AI Testing theme:
   - Callback form captures + reaches all configured destinations.
   - Cart-page proactive fires after configured idle.
   - Cross-sell suggestions are relevant on 3 sample carts.
   - Bulk threshold mentions only when applicable.
3. Verify live published storefront unaffected (theme embed off there).
4. Hand off: merchant tweaks dashboard themselves over week of real traffic.

---

## Cross-references

- Source discovery: `docs/SHOPIFY/CLIENT-DISCOVERY-INBUILDUK.md` §2a (features B + C)
- Hard dependency: `docs/PRDS/PRD-007-PROACTIVE-WIDGET-ENGAGEMENT.md`
- Architecture flows touched: `docs/ARCHITECTURE.md` Flow W (storefront widget) + new Flow K (callback handoff)
- Sibling repos involved: `automatos-widget-sdk` (callback form UI + cart triggers + cross-sell cards), `automatos-ai` (callback endpoint + destination services + skill updates + dashboard UI)
- Skills to update:
  - `automatos-skills/shopify/shopify-support/SKILL.md` — callback intent handling
  - `automatos-skills/shopify/shopify-merchandiser/SKILL.md` — cart-page cross-sell tool wiring
  - `automatos-skills/shopify/shopify-supplier-management/SKILL.md` — bulk-threshold lookup tool wiring
- Discovery follow-up items addressed: #2 (callback dest), #3 (callback SLA), #4 (bulk config), #5 (cross-sell source)
