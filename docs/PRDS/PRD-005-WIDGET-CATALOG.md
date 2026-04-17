# PRD: Widget Catalog Completion

**PRD ID:** SHOPIFY-005
**Status:** Draft
**Owner:** Gerard
**Date:** 2026-04-16
**Priority:** P1 — Moat. Two widgets is a demo; nine is a product.

---

## Problem

`app/routes/app.widgets._index.tsx` advertises 9 widgets across storefront + admin tiers. The widget-sdk monorepo ships **2**: chat and blog.

| Slug | Surface | Tier | Status | Agent binding |
|---|---|---|---|---|
| `chat` | storefront | 1 | ✅ built | `shopify-support` |
| `product-qa` | storefront | 1 | 📄 liquid scaffold only | `shopify-product-expert` |
| `blog` | storefront | 1 | ✅ built | `shopify-seo-content` |
| `daily-brief` | admin | 1 | ❌ not started | `shopify-business-analyst` |
| `inventory` | admin | 1 | ❌ not started | `shopify-inventory-watchdog` |
| `reviews` | storefront | 2 | 📄 liquid scaffold only | `shopify-review-analyst` |
| `gift-finder` | storefront | 2 | ❌ not started | `shopify-gift-concierge` |
| `shopper` | storefront | 2 | ❌ not started | `shopify-merchandiser` |
| `cart` | storefront | ? | ❌ not started (listed in route) | — |

Every missing widget is a revenue surface we're paying for (agents seeded, marketing advertises them, merchants expect them) but not shipping.

---

## Goal

Ship all 9 widgets to production quality, gated on SHOPIFY-003 (CDN) being live so new widgets don't require Partner-app re-releases to deploy.

---

## Success Criteria

| Check | Pass condition |
|---|---|
| All 9 widgets have SDK packages | Yes |
| All 9 widgets have theme extension app blocks (storefront) or admin mount points | Yes |
| Each widget renders with real data on `1lovefragrance` | Yes |
| Each widget respects the `respect_consent` / GDPR pattern (storefront only) | Yes |
| Bundle size per widget ≤ 15 KB gzip | Yes |
| Total loader + all-widgets bundle ≤ 80 KB gzip | Yes, or splits into per-widget CDN paths |
| Each widget has a Polaris admin config page in the embedded app | Yes |

---

## Scope

### In scope
- 7 new widgets built to the existing chat/blog SDK pattern
- Admin-surface widgets (`daily-brief`, `inventory`) use a different mount strategy — see Implementation plan
- Per-widget app block in `extensions/automatos-theme/blocks/*.liquid`
- Per-widget Polaris configuration page under `app/routes/app.widgets.$slug.tsx`
- Per-widget agent binding enforced server-side (SDK passes `agentId` from block setting; orchestrator validates it belongs to workspace)

### Out of scope
- New agents — the 9 agents already seed from `automatos.server.ts`. This PRD consumes them, doesn't define them.
- Custom theming per widget beyond what the chat pattern already supports (CSS custom properties via `themeOverrides`)
- Analytics / conversion tracking per widget (separate PRD, depends on analytics infra)
- A/B testing framework

---

## Prioritization (ship order)

1. **`product-qa`** — P1, highest revenue impact (conversion lift on PDP is the easiest number to sell to merchants). Liquid scaffold exists; needs SDK package + wiring.
2. **`reviews` (review-summary)** — P1, social proof on PDP. Liquid scaffold exists; needs SDK package.
3. **`daily-brief`** — P1, admin surface, sellable as "open Shopify admin, see AI summary first thing every morning". Mounts in embedded app.
4. **`inventory` (watchdog)** — P2, admin. Pairs with daily-brief narratively.
5. **`gift-finder`** — P2, storefront. Conversational quiz, longer build.
6. **`shopper` (conversational)** — P2, storefront. Overlaps with chat; possibly deprioritize or merge.
7. **`cart`** — P3, decide whether to actually ship — currently in the UI list but ambiguous surface.

---

## Implementation plan

### Pattern per storefront widget

1. **SDK package:** `automatos-widget-sdk/packages/<widget-name>/` — mirror `chat-widget/` structure:
   - `src/index.ts` — entry, `AutomatosWidget.init` registration
   - `src/<widget-name>.ts` — main class
   - `src/components/*.ts` — UI pieces (Shadow DOM vanilla JS)
   - `src/styles/*.ts` — CSS as tagged template strings
   - `src/dom/shadow-host.ts` — Shadow root setup
   - `tsup.config.ts` — IIFE + ESM + CJS outputs
2. **Loader entry** — extend `packages/loader/src/index.ts` to register the new widget type
3. **Theme app block** — `extensions/automatos-theme/blocks/<widget-name>.liquid` following `chat-widget.liquid`:
   - Liquid settings schema for api_key, agent_id, appearance
   - Script tag loading from CDN (`sdk.automatos.app/v1/<widget-name>.js` once SHOPIFY-003 lands)
   - Consent gate
4. **Admin config page** — `app/routes/app.widgets.<widget-name>.tsx` — Polaris form letting merchant toggle the widget, set agent, preview
5. **Agent validation** — orchestrator confirms the passed `agentId` is scoped to the workspace and has the right skills (prevent public-key exfiltration to route calls to another workspace's agent — overlaps with SHOPIFY-006)

### Admin widgets (different pattern)

`daily-brief` and `inventory` don't render in the storefront — they mount inside the embedded Polaris app. Two options:

- **Option A — Native Polaris React components.** Built directly in `automatos-shopify/app/routes/app.widgets.<slug>.tsx`. Uses the SDK `core` package for API + streaming but the UI is Polaris, not Shadow DOM. Simplest; tightly coupled to embedded app.
- **Option B — Same SDK pattern, mounted into a Polaris `<Card>`.** Widget bundle reused. Extra indirection. Only worth it if these admin widgets will also live in non-Shopify surfaces later.

**Recommendation:** Option A for MVP. Revisit if admin widgets need cross-platform reuse.

### Agent binding model

Each widget hard-codes the agent slug it expects (e.g., `chat → shopify-support`). The orchestrator refuses tool calls if the passed `agentId` doesn't resolve to the expected slug. This prevents misconfiguration and scopes the blast radius of a leaked public API key.

---

## Risks

| Risk | Mitigation |
|---|---|
| Bundle bloat as widgets multiply | Split per-widget CDN paths once combined bundle exceeds 40 KB gzip |
| Merchant loads 5+ widgets on one page, latency tanks | Lazy load widgets below the fold; defer non-critical bundles |
| Agent binding drift (widget expects agent X, but merchant's workspace never seeded agent X) | Fail loud with actionable error in Polaris admin UI, not silently |
| Review-summary widget pulls reviews from Shopify's built-in reviews API but merchant uses Judge.me / Loox | Abstract review source behind an orchestrator integration tool; route at workspace config time |
| GDPR consent gating breaks on merchants who've disabled `customerPrivacy` API | Default: widget loads (legacy behaviour); merchant can opt into consent gating via block setting |

---

## Open questions

- What's the MVP quality bar per widget? "Matches designs" is too loose. Recommend: renders with real data, agent binding validated, bundle under size limit, zero console errors on `1lovefragrance`.
- Do we ship any widget on Shopify Plus-only features (e.g., checkout extensions) in this PRD, or defer? Currently out of scope — checkout extensions need a separate PRD due to Plus licensing constraints.
- `cart` widget — what does it actually do? List in `app.widgets._index.tsx` gives no description for it. Clarify or drop.
