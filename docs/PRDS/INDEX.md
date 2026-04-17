# Shopify PRD Index

**Last updated:** 2026-04-16 (evening — see `docs/STATUS.md` for session checkpoint)
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

---

## Phase ordering

```
Phase 0 — PoC (DONE-ISH, client demo tomorrow)
  └─ Composio connection proven end-to-end on 1lovefragrance

Phase 1 — Pre-deploy hygiene (this week)
  ├─ SHOPIFY-002  Scope reconciliation (BLOCKER for next app deploy)
  └─ SHOPIFY-006  Widget auth model (security-critical before CDN goes live)

Phase 2 — Ship existing widgets properly
  ├─ SHOPIFY-003  CDN distribution
  └─ SHOPIFY-004  Unified install flow

Phase 3 — Expand the moat
  └─ SHOPIFY-005  Widget catalog (7 more widgets)

Phase 4 — Cross-platform (future, not yet PRD'd)
  └─ WordPress / WooCommerce / Squarespace via same SDK
```

Don't skip Phase 1 items. SHOPIFY-002 prevents a merchant re-auth cascade; SHOPIFY-006 prevents abuse of public API keys once the CDN goes live.

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
