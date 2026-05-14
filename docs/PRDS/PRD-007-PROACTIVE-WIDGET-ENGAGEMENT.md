# PRD: Proactive Widget Engagement

**PRD ID:** SHOPIFY-007
**Status:** v1 code complete + unit tested (80 tests passing across 3 repos). Pending: cross-repo deploy + dashboard UI panel (deferred to follow-up).
**Owner:** Gerard
**Date:** 2026-05-11 (v0.1) → 2026-05-12 (v0.2 defaults locked) → 2026-05-13 (v0.3 code+tests complete)
**Priority:** P1 — Foundational for client retention; INBUILD UK's flagship ask. Required for the v1 demo to feel like more than a generic chatbot.

## Build status (2026-05-13)

| Component | Repo | State | Tests |
|---|---|---|---|
| Page-context data attrs | `automatos-shopify/extensions/automatos-theme/blocks/chat-widget.liquid` | ✅ done | n/a (Liquid) |
| Workspace seeder defaults | `automatos-ai/orchestrator/api/shopify.py` | ✅ done | ✅ 2 tests |
| `GET /api/widgets/config` endpoint | `automatos-ai/orchestrator/api/widgets/config.py` (new) | ✅ done | ✅ 4 tests |
| `widget_config` in `SessionTokenResponse` | `automatos-ai/orchestrator/api/widgets/session.py` | ✅ done | ✅ 2 tests |
| `page_context` + `trigger_reason` in `WidgetChatRequest` | `automatos-ai/orchestrator/api/widgets/chat.py` | ✅ done | ✅ 3 tests |
| Proactive opener prompt synthesis | `automatos-ai/orchestrator/api/widgets/chat.py` | ✅ done | ✅ 4 tests |
| Skill: proactive opener mode | `automatos-skills/shopify/shopify-support/SKILL.md` | ✅ done | n/a (markdown) |
| `PageContext` + `WidgetProactiveConfig` types | `automatos-widget-sdk/packages/core/src/types.ts` | ✅ done | typecheck clean |
| Page-context reader | `automatos-widget-sdk/packages/loader/src/proactive/page-context.ts` | ✅ done | ✅ 10 tests |
| `DismissalStore` (session/day/until_navigation) | `…/proactive/dismissal-store.ts` | ✅ done | ✅ 6 tests |
| `ProactiveEngine` (4 trigger types) | `…/proactive/proactive-engine.ts` | ✅ done | ✅ 12 tests |
| `ProactivePopup` Shadow DOM component | `…/proactive/proactive-popup.ts` | ✅ done | ✅ 9 tests |
| `fetchWidgetConfig` helper | `…/proactive/config-fetcher.ts` | ✅ done | ✅ 5 tests |
| `bootstrapProactive` wired into `init()` | `…/loader/src/index.ts` | ✅ done | covered indirectly |
| SDK docs | `automatos-widget-sdk/docs/EMBEDDING.md` §3a | ✅ done | n/a |
| Shopify install docs | `automatos-shopify/docs/SHOPIFY/SETUP-GUIDE.md` § proactive activation | ✅ done | n/a |
| Onboarding runbook | `automatos-shopify/docs/RUNBOOKS/client-onboarding.md` §4a | ✅ done | n/a |
| **Dashboard UI panel** | `automatos-ai/frontend/components/workspace/*` | ⏳ deferred — curl PATCH works for v1 | — |
| **Cross-repo deploy** | widgets CDN, Railway, Shopify theme deploy | ⏳ requires user go-ahead | — |

**Total: 80 unit tests passing** (22 SDK core + 42 SDK loader + 16 orchestrator).

**Source discovery:** `docs/SHOPIFY/CLIENT-DISCOVERY-INBUILDUK.md` (Feature A; this PRD scopes only A)
**Follow-up PRD:** PRD-008 (Feature B — callback handoff, Feature C — cart abandonment + cross-sell + bulk discounts). Both depend on this one landing first.

---

## Problem

Today the Automatos chat widget is a passive icon in the storefront corner. Shoppers have to actively click it to engage. The result:

- Engagement rate is dominated by shoppers who already know they need help.
- The bot has no awareness of what page or product the shopper is on, so the conversation starts cold — generic greetings, no context, no value differentiator vs. a generic "live chat" widget.
- Merchants see this as "a chatbot we installed" rather than "an assistant that drives conversions". Hard to defend the value at renewal.

INBUILD UK called this out directly:

> *"The bot needs to identify what page of the website the potential purchaser is on. The bot should pop up with questions about why product are you looking for, do you want a specific size."*

The same need will recur for every merchant. This PRD turns the widget from "icon-and-wait" into "context-aware engagement".

---

## Goal

A merchant-configurable proactive engagement layer on the storefront widget that:

1. Detects the shopper's current page/product context client-side.
2. Decides whether and when to surface a small notification (per-merchant config: trigger type, timing, frequency cap, dismissal persistence).
3. Pulls a context-relevant opener from the agent (or uses a canned line for speed) — never generic.
4. Stays polite — dismissable, frequency-capped, never re-pops within the configured window.

Importantly: this is a PoC for the larger Partner product. The whole design should be **merchant-configurable**, not hardcoded for INBUILD UK. Config lives in the Automatos dashboard; response logic lives in the agent.

---

## Architectural principle (sets every design decision below)

| Layer | Owns | Reason |
|---|---|---|
| **Shopify-side** (theme extension + widget runtime) | *When* the bot engages — trigger detection, timing, frequency caps, dismissal state, popup UI. | Configuration the merchant can change without a code deploy. Lives in their dashboard. |
| **Automatos-side** (orchestrator + agent + skill) | *What* the bot says — greeting text, recommendations, escalation. | Response intelligence belongs with the agent. The widget is a dumb messenger. |

Translation: the widget sends `{page_context, trigger_reason}` to the orchestrator and the orchestrator returns `{greeting_text, suggested_chips, recommended_products[]?}`. Same widget code, different agent persona/skill per merchant.

---

## Success Criteria

| Check | Pass condition | Measurement |
|---|---|---|
| Widget detects page/product context client-side | Page type (`product`, `collection`, `cart`, `page`, `home`, `blog`) + product ID/handle (where applicable) sent in widget init | Browser devtools network tab on `inbuilduk.myshopify.com` preview |
| Merchant can toggle proactive mode ON/OFF | Single toggle in Automatos dashboard → reflected in widget runtime without theme republish | Smoke test on INBUILD UK workspace |
| Merchant can configure trigger type + timing | At least time-on-page (with seconds threshold); other triggers configurable via the same UI | Manual config change → behaviour changes on next page load |
| Popup respects frequency cap | Dismissed popup doesn't reappear within configured window | sessionStorage / localStorage entry honoured |
| Greeting reflects current product | Greeting on a fan product page mentions fans (or class of products), not generic | Manual visual check on 3 different product pages |
| Default behaviour is OFF | Newly installed widget does NOT proactively pop unless the merchant explicitly enables | Dev-store install confirms silent default |
| No regression on the existing passive chat icon | Existing click-to-open chat still works exactly as today | Smoke test on `1lovefragrance` (existing PoC) |
| Works across all four theme app blocks (chat is the body-target one) | Section-target widgets unaffected; chat-widget gains the proactive feature | Theme customizer manual check |
| Cookie consent respected | If merchant has `respect_consent = true`, popup is suppressed when marketing consent is declined | Manual GDPR-mode test |

---

## Scope

### In scope (PRD-007 — Feature A)

- Page context detection — read from `window.Shopify`, URL pattern, JSON-LD, or theme-injected data attributes.
- Trigger types — at minimum: time-on-page, scroll depth, exit intent, idle. Configurable per merchant.
- Frequency cap mechanism — sessionStorage and localStorage windows.
- Popup UI component in the widget SDK — corner bubble + slide-in card variants. Dismissable.
- Backend endpoint extension — orchestrator accepts page context + trigger reason, returns a tailored opener.
- Merchant-facing config in Automatos dashboard — toggles + numeric inputs for triggers, frequency, popup style.
- Theme block updates to pass `{ page_type, product_id, product_handle, template }` as data attributes.
- Skill update for `shopify-support` to handle "proactive opener" prompts distinct from user-initiated chats.
- Default behaviour OFF; merchant must opt in.

### Out of scope (deferred to PRD-008 or later)

- **Feature B** (callback handoff with phone capture) — separate escalation pathway.
- **Feature C1** (cart abandonment recapture beyond on-site nudge) — requires email + Shopify email flow.
- **Feature C2** (cart-page cross-sell of products) — depends on a "recommendation source" decision first.
- **Feature C3** (bulk pricing offers) — requires Shopify-side discount config to exist.
- Email-channel abandonment recovery (after the shopper leaves the site).
- Server-driven personalization based on shopper history / RFM segmentation.
- A/B testing infrastructure for openers (single opener variant in v1).
- Per-product-page-template custom triggers (works per page-TYPE in v1, not per individual product).
- Multi-language support beyond what the widget already does.

---

## User stories (the "what does it look like in practice" view)

### Story 1 — Merchant enables proactive mode

> *As INBUILD UK, I install the Automatos app, get the chat widget working on AI Testing theme, then go to my Automatos dashboard to enable proactive popups on product pages. I set "after 20 seconds on a product page" as the trigger. I dismiss-once-per-session is fine. I save. Within minutes the next preview of AI Testing shows the new behaviour.*

### Story 2 — Shopper on a product page sees a contextual pop

> *As a contractor browsing an EN 12101-9 control panel page on INBUILD UK, I scroll, look at specs, and stay on the page. After 20 seconds, a small notification slides in: "Looking at the EN 12101-9 panel? Most installers also ask about which actuators are compatible. Want me to walk through it?" I either click to chat, dismiss the popup (it doesn't come back this session), or ignore it and continue browsing.*

### Story 3 — Shopper has already engaged

> *As a returning shopper who clicked the chat icon earlier on this visit and asked one question, I'm now on a different product page. The proactive popup does NOT reappear — I've already engaged this session. The chat icon is still there if I want to ask more.*

### Story 4 — GDPR-cautious shopper

> *As an EU shopper who has not accepted marketing cookies, the chat icon loads but the proactive popup never fires. Behaviour reverts to today's passive-icon mode until consent is granted.*

### Story 5 — Merchant turns it off mid-trial

> *As a merchant who finds the proactive popup is too aggressive in their analytics, I go to the dashboard, toggle proactive OFF, save. The next storefront page load reverts to passive-icon-only.*

---

## Configuration model (data shape)

The Automatos workspace stores per-merchant widget config. The widget reads this on init (alongside the API key + agent ID it already gets).

```jsonc
{
  "widget_proactive": {
    "enabled": false,                          // default OFF — opt-in
    "page_types": ["product", "collection"],   // where to fire
    "triggers": [
      {
        "type": "time_on_page",
        "seconds": 20
      }
      // future: { "type": "scroll_depth", "percent": 60 }, etc.
    ],
    "frequency_cap": {
      "scope": "session",                      // session | day | product_session
      "max_pops": 1
    },
    "greeting_source": "agent",                // "agent" (LLM) | "canned" | "agent_with_canned_fallback"
    "canned_fallback": "Need a hand finding the right product?",
    "popup_style": "corner_bubble",            // corner_bubble | slide_in_card
    "respect_consent": true,                   // already present in chat-widget.liquid
    "dismissal_persistence": "session"         // session | day | until_navigation
  }
}
```

This shape needs to be added to the orchestrator's workspace settings model. The Liquid block fetches it via a public endpoint on widget init (the same handshake that already returns the JWT + workspace context).

[OPEN — confirm orchestrator owner for the workspace-settings extension]

---

## Implementation plan

### 1. Widget runtime (in `automatos-widget-sdk` — separate repo)

**Files:** `packages/loader/src/**`

- Add `ProactiveEngine` module:
  - Read page context from `window.Shopify` / `document.querySelector('meta[name="product-id"]')` / URL pattern / data attributes injected by the Liquid block.
  - Register trigger handlers per type (`time_on_page`, `scroll_depth`, `exit_intent`, `idle`).
  - Maintain dismissal state in sessionStorage (or localStorage when scope = `day`).
  - Render `<aw-proactive-popup>` Shadow-DOM element on trigger fire.
- New `popup` UI component — variants `corner_bubble` and `slide_in_card`.
- Init flow gains a `getProactiveConfig` call to the orchestrator (or reads it from the existing init response if we extend that).
- Bundle output: still one `widget.global.js` from the loader package. No new HTTP hop on the critical path.

**Effort:** 2–3 days incl. testing.

### 2. Theme extension (in `automatos-shopify`) — ✅ LANDED 2026-05-12

**Files:** `extensions/automatos-theme/blocks/chat-widget.liquid`

Done today (additive only, zero risk before SDK consumes it):
- Page context exposed as `data-*` attributes on the widget root `<div>`: `page-type`, `page-template`, `product-id`, `product-handle`, `product-type`, `product-vendor`, `collection-id`, `collection-handle`, `shop-domain`, `shop-currency`, `shop-locale`, `customer-id`, `cart-item-count`.
- Same payload passed as `pageContext` object on `AutomatosWidget.init({...})` — current SDK ignores unknown keys, future SDK consumes it directly.
- Cookie-consent gate (`respect_consent`) still wraps init; proactive popup inherits this gate automatically.
- No new theme schema fields — config stays dashboard-side per architectural principle.

**Status:** Done. Needs `shopify app deploy --config=automatos-ai` to ship to INBUILD UK once their app is installed.

### 3. Orchestrator (in `automatos-ai`)

**Files:** `orchestrator/api/widgets/`, `orchestrator/core/models/workspaces.py`

- Add `widget_proactive` JSON column or nested key inside `workspace.settings`.
- Add `GET /api/widgets/config` endpoint (or extend session-init response) that returns the proactive config alongside the JWT.
- Update widget chat-init endpoint to accept `page_context` + `trigger_reason` payload. Route to the agent with this as additional context.
- Skill update for `shopify-support`: when the input is a `proactive_opener` event (not a user message), the agent generates an opener relevant to the product, not a response to a user message. Different prompt template.

**Effort:** 1.5–2 days.

### 4. Automatos dashboard UI

**Files:** `frontend/components/workspace/WidgetSettings.tsx` (or wherever workspace widget config lives)

- Add a "Proactive Engagement" panel to the workspace's widget settings.
- Form fields matching the config shape above.
- Toggle ON/OFF at the top — when OFF, hide the rest.
- Live "preview" of what the popup will look like with current settings.

**Effort:** 1 day.

### Total

~5 days for v1 across the four codebases. No dependencies on each other after the orchestrator schema lands (which is the only thing on the critical path).

---

## Defaults locked for v1 (was: open questions)

The seven items below were `[OPEN]` in v0.1 pending merchant input. To unblock the v1 build, defaults are now locked. Merchant can change any of these in the dashboard post-launch — these are starting positions, not commitments. Only item #7 (brand voice) still needs explicit merchant sign-off before the opener goes live.

| # | Question | v1 default | Reason |
|---|---|---|---|
| 1 | **§4b — Trigger** | `time_on_page` = 20s | Conservative; engages shoppers who linger without interrupting browsers. Scroll-depth + exit-intent added as configurable but disabled by default. |
| 2 | **§4c — Frequency cap** | `scope: session`, `max_pops: 1` | One pop per visit. Lowest risk of feeling pushy. Per-product-per-session deferred until we have data. |
| 3 | **§4d — Greeting source** | `agent_with_canned_fallback`. Canned shown in ≤200ms, replaced by agent text when ready. Keep canned if agent > 1500ms. | PRD author's recommendation. Personal feel without the dead-air latency. |
| 4 | **§4e — Popup style** | `corner_bubble` | Chat-like, lower visual disruption than slide-in card. Card is configurable but off by default. |
| 5 | **§4f — Dismissal persistence** | `session` | Matches frequency cap (#2). Dismissed = gone for this visit. |
| 6 | **Page types that fire** | `product` only for v1 | INBUILD UK's explicit ask. Collection / home / cart additions land in PRD-008 (cart) and post-v1. |
| 7 | **Brand-voice opener** | **STILL OPEN** — drafted: *"technical, plain-spoken, never pushy"* per `CLIENT-DISCOVERY-INBUILDUK.md` §3. Needs merchant sign-off before going live. | Persona prompt drives every opener; merchant should approve the tone once before traffic sees it. |

### Default config payload (what the dashboard ships with on workspace creation)

```jsonc
{
  "widget_proactive": {
    "enabled": false,                          // opt-in
    "page_types": ["product"],
    "triggers": [
      { "type": "time_on_page", "seconds": 20 }
    ],
    "frequency_cap": { "scope": "session", "max_pops": 1 },
    "greeting_source": "agent_with_canned_fallback",
    "canned_fallback": "Need a hand finding the right product?",
    "agent_timeout_ms": 1500,
    "popup_style": "corner_bubble",
    "respect_consent": true,
    "dismissal_persistence": "session"
  }
}
```

### Reversibility note

All seven defaults are dashboard-editable per workspace. The merchant can override any of them at any time without a code deploy. If our defaults turn out to be wrong, we change the default in the workspace seeder, not in the widget runtime.

---

## Risks

| Risk | Mitigation |
|---|---|
| Popup feels pushy → hurts conversion | Default OFF; conservative defaults if enabled (20s on product pages only, once per session); merchant-controlled. |
| LLM greeting latency feels broken | `agent_with_canned_fallback` mode — show canned text in 200ms, replace with LLM text when ready (or just keep canned if LLM > 1.5s). |
| Page context detection unreliable across themes | Inject context via the Liquid block as data attributes (we control this), don't rely on `window.Shopify` alone (some themes strip it). |
| Multi-tab dismissal state inconsistent | sessionStorage is per-tab; use localStorage for "day" scope. Trade-off accepted. |
| Frequency-cap bypass by clearing storage | Live with it — this is a UX nudge, not a security boundary. |
| `respect_consent` interactions with proactive trigger | Test path explicitly: consent declined → proactive suppressed → consent granted later → proactive enabled mid-session. |
| Merchant configures aggressively, shoppers complain | Dashboard UI surfaces recommended defaults; "preview" shows what shoppers will see; analytics in week 2 (dismiss rate, conversion lift) make this visible. |

---

## What this PRD does NOT decide (intentionally)

- Per-product custom openers (e.g. INBUILD UK wants the EN 12101-9 page opener to mention installers specifically). v1 templates the opener generically by product type; per-product custom prompts are post-v1.
- Cross-merchant analytics aggregation (e.g. "merchants who use proactive convert N% better"). Track but don't expose in v1.
- Multi-variant testing of opener phrasing. v1 ships single variant; A/B tooling is post-v1.
- Per-shopper personalization based on history. Anonymous sessions only in v1.

---

## Acceptance plan for INBUILD UK v1 demo

After merchant has answered the `[OPEN]` items above:

1. Update workspace config in dashboard with their chosen defaults.
2. Verify AI Testing theme preview fires the proactive popup as configured.
3. Verify the published live storefront does NOT fire it (chat widget still off there).
4. Confirm the opener references the product being viewed.
5. Confirm dismissal honoured for the configured window.
6. Hand-off: merchant tweaks defaults from the dashboard themselves over a week of real traffic; we review dismiss rate / conversion data with them at end of week.

---

## Cross-references

- Source discovery: `docs/SHOPIFY/CLIENT-DISCOVERY-INBUILDUK.md`
- Template for future merchants: `docs/SHOPIFY/CLIENT-DISCOVERY-TEMPLATE.md` §4
- Architecture flows touched: `docs/ARCHITECTURE.md` Flow W (the storefront-widget flow)
- Sibling repos involved: `automatos-widget-sdk` (popup UI + trigger engine), `automatos-ai` (orchestrator schema + skill update + dashboard UI)
- Skill to update: `automatos-skills/shopify/shopify-support/SKILL.md` — add "proactive opener" handling
- Deferred follow-up PRD: PRD-008 (Features B and C)
