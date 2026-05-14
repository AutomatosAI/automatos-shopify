# Shopify PRD Index

**Last updated:** 2026-05-14
**Owner:** Gerard

---

## Purpose

Tracks all product requirements docs governing the Automatos ↔ Shopify integration. Each PRD is a self-contained build brief. This index tells you what's been decided, what's in flight, and what blocks what.

---

## PRD map

| ID | Title | Priority | Status | Depends on |
|---|---|---|---|---|
| [SHOPIFY-001](PRD-001-SHOPIFY-PLATFORM.md) | Shopify Platform Integration (umbrella) | P0 | Draft | — |
| [SHOPIFY-002](PRD-002-SCOPE-RECONCILIATION.md) | Partner App scope reconciliation | P0 | Draft | — |
| [SHOPIFY-003](PRD-003-CDN-DISTRIBUTION.md) | Widget SDK CDN distribution | P1 | Draft | — |
| [SHOPIFY-004](PRD-004-UNIFIED-INSTALL-FLOW.md) | Unified install flow (one-click) | P1 | Draft | 003 |
| [SHOPIFY-005](PRD-005-WIDGET-CATALOG.md) | Widget catalog completion (7 widgets) | P1 | Draft | 003 |
| [SHOPIFY-006](PRD-006-WIDGET-AUTH-MODEL.md) | Widget auth model (public key → workspace) | P0 | Draft | — |
| [SHOPIFY-007](PRD-007-PROACTIVE-WIDGET-ENGAGEMENT.md) | Proactive widget engagement | P1 | Shipped 2026-05-13 (polish pending) | 003, 006 |
| [SHOPIFY-008](PRD-008-CALLBACK-AND-CART-FEATURES.md) | Callback + cart features (umbrella) | — | Split 2026-05-14 — see 008-A and 008-B | 007 |
| **[SHOPIFY-008-A](PRD-008-A-HUMAN-HANDOFF-AND-SITES.md)** | **Human handoff + Sites foundation** | **P1** | **Code complete 2026-05-14 — ready for merge + smoke test** ([runbook](../RUNBOOKS/prd-008-a-smoke.md)) | 007 |
| SHOPIFY-008-B | Cart commerce intelligence (cross-sell + bulk pricing) | P2 | Deferred — re-scoped after 008-A ships | 008-A, 009 Layer 2 |
| [SHOPIFY-009](PRD-009-PRODUCT-KNOWLEDGE-GROUNDING.md) | Product knowledge grounding | P1 | Parked — Layer 1 shipped; Layers 2–3 resume after 008-A | 007 |

---

## Phase ordering

```
Phase 0 — PoC ✅ DONE
  └─ Composio connection proven end-to-end on 1lovefragrance + besafe-ltd

Phase 1 — Pre-deploy hygiene (in progress)
  ├─ SHOPIFY-002  Scope reconciliation
  └─ SHOPIFY-006  Widget auth model

Phase 2 — Ship existing widgets properly
  ├─ SHOPIFY-003  CDN distribution
  └─ SHOPIFY-004  Unified install flow

Phase 3 — Engagement foundation ⬅ NEXT ACTIVE WORK
  ├─ SHOPIFY-007    Proactive engagement (✅ shipped, polish pending)
  └─ SHOPIFY-008-A  Human handoff + Sites foundation (NEXT — 13 days)
                    Introduces Sites architecture: universal hub that makes
                    every future channel (Wix, WooCommerce, custom) a
                    ~2-day adapter. PoC client INBUILD UK validates here.

Phase 4 — Knowledge layer (post 008-A)
  └─ SHOPIFY-009    Product knowledge grounding (Layers 2–3 — catalog
                    graph via Composio bulk sync + pgvector, live actions)

Phase 5 — Commerce intelligence (gated on Phase 4)
  └─ SHOPIFY-008-B  Cross-sell + bulk pricing (re-scoped after 009 Layer 2
                    lands — without grounding, these features fabricate)

Phase 6 — Cross-platform expansion (4.6M reach)
  ├─ Wix Site adapter on Sites foundation (~2 days)
  ├─ WooCommerce Site adapter (~3 days)
  └─ Custom embed flow polish
```

Don't skip Phase 1 items. SHOPIFY-002 prevents a merchant re-auth cascade; SHOPIFY-006 prevents abuse of public API keys once the CDN goes live.

**Why Phase 3 first**: PRD-008-A's Sites architecture is the prerequisite for cross-platform scale. Building any future channel without it means rewriting the dashboard. Building it once unlocks the 4.6M-merchant reach beyond Shopify too.

---

## Open product questions (block specific PRDs)

1. **Workspace provisioning strategy** (blocks SHOPIFY-004) — auto-provision on Shopify install, "link existing account" screen, or pre-registration required? Each has UX / conversion tradeoffs.
2. ~~**CDN provider** (blocks SHOPIFY-003)~~ — **Decided: AWS S3 + CloudFront** (leveraging existing AWS footprint).
3. **Admin widget mounting** (blocks SHOPIFY-005 for admin tier) — do Polaris-embedded widgets share the SDK bundle or ship as part of the embedded app? Deliverable changes either way.
4. ~~**Composio token import API**~~ — **Partial answer (2026-04-16):** `connectedAccounts.create()` does NOT exist on the SDK. Methods are `delete, disable, enable, get, initiate, link, list, refresh, update, updateStatus, waitForConnection`. Next spike: probe `.link()` and `.update()` with a real Shopify access token. If both fail, fall back to silent-OAuth. See PRD-004 "Spike result" section.

---

## How to use

- Every feature ships against exactly one PRD. Cross-PRD work is a smell — split the work or consolidate the PRDs.
- Status transitions: `Draft → In Progress → In Review → Done`.
- When a PRD goes `Done`, move its acceptance checklist to a changelog entry in the repo. Don't let `Done` PRDs accumulate ambiguity about what was actually shipped.
- If a PRD's acceptance criteria change mid-flight, bump a version header and note the reason. Don't edit silently.
