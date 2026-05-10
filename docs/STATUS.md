# Automatos ↔ Shopify — Status

**Snapshot:** 2026-05-07, mid-session checkpoint
**Last meaningful change:** API contract refactor + onboarding runbook + clients registry
**Next milestone:** PoC install on `innobuilduk.myshopify.com` dev store (pending merchant access)

---

## Where things actually stand

| Item | Status | Where |
|---|---|---|
| Partner app deployed to Partner Dashboard | ✅ live | `client_id=f184b73f2d841c1972744565325d3548` |
| Scope reconciliation (PRD-002) — 34 scopes in toml & composio-setup.mjs | ✅ done | `shopify.app.toml`, `scripts/composio-setup.mjs` |
| CDN cutover (PRD-003) — widgets ship from `widgets.automatos.app/v0` | ✅ landed | commit `b333984` |
| Theme extension Liquid points at CDN | ✅ done | commit `b333984` |
| Orchestrator `/api/shopify/*` namespace deployed | ✅ live | verified `api.automatos.app` returns 422 on bad bodies, not 404 |
| Shopify-side client matches new contract | ✅ done today | `app/automatos.server.ts`, `app/routes/auth.callback.tsx`, `app/routes/webhooks.app.tsx` |
| `composio-resume.mjs` PoC-ready | ✅ done today | toolkit version pinned, smoke-test slugs corrected |
| Per-client onboarding runbook | ✅ done today | `docs/RUNBOOKS/client-onboarding.md` |
| Per-merchant registry | ✅ done today | `docs/SHOPIFY/CLIENTS.md` |
| Unified install flow (PRD-004) — auto-Composio on App Store install | 🟡 partial | spike done; orchestrator `/api/shopify/connect` does NOT yet register Composio connection. Manual step still required. |
| Widget auth model (PRD-006) — public-key tier gates, JWT, CORS | 🟡 design locked | not implemented |
| PoC install end-to-end on a fresh merchant | ⏳ pending | waiting on `innobuilduk` dev store access |

---

## What changed today (2026-05-07)

### Contract refactor

The committed `automatos.server.ts` had been silently 404ing against production for some time — the orchestrator's Shopify endpoints had moved from `/api/workspaces/*` + `/api/integrations/shopify/*` to a unified `/api/shopify/*` namespace, but the Shopify client was never updated. A previous agent had started the refactor (uncommitted) but introduced a `seedAgents()` call-site mismatch that would crash on every install.

Rolled back the half-finished refactor and re-did it cleanly:

- **`app/automatos.server.ts`** — calls `/api/shopify/{provision, connect, deactivate, sync, events}`. New return types match the orchestrator's Pydantic models exactly. `provisionWorkspace` now returns `{id, public_id, api_key, agents_installed, is_new}` in one call. Auth header is conditional on `AUTOMATOS_API_KEY` being set (dev mode just doesn't send it).
- **`app/routes/auth.callback.tsx`** — drops the dead `seedAgents()` call (now bundled in `/provision`). Logs `workspace.public_id`, `agents_installed`, `is_new`, `key_prefix` so a successful install is grep-able from logs.
- **`app/routes/webhooks.app.tsx`** — `onOrderCreate` renamed to generic `onShopifyEvent(shop, event, payload)`.

### Composio scripts

- **`scripts/composio-resume.mjs`** — toolkit version pinned (`20260414_00`), smoke test swapped from non-existent `SHOPIFY_LIST_PRODUCTS` to `SHOPIFY_GET_SHOP_DETAILS` + `SHOPIFY_COUNT_PRODUCTS`. Hardened to fail loudly if either smoke test errors. (Both gotchas were already documented in `COMPOSIO-SHOPIFY-SETUP.md` but the scripts hadn't been updated to match.)
- **`scripts/composio-setup.mjs`** — same fixes (toolkit pin + smoke-test slug).
- **`scripts/composio-check.mjs`** — same fixes; `COMPOSIO_CONNECTION_ID` now overridable via env (was hardcoded).

### Documentation

- **`docs/RUNBOOKS/client-onboarding.md`** (new) — one-page checklist for onboarding a new merchant. This becomes the launch-day playbook.
- **`docs/SHOPIFY/CLIENTS.md`** (new) — registry of every onboarded merchant. `1lovefragrance` row populated; `innobuilduk` row reserved.
- **`docs/ARCHITECTURE.md`** — Flow I sequence diagram updated to match `/api/shopify/*`. CDN URL corrected to `widgets.automatos.app/v0` (was `sdk.automatos.app/v1`).
- **`docs/PRDS/PRD-004-UNIFIED-INSTALL-FLOW.md`** — endpoint references updated to `/api/shopify/connect`. "Current state" section corrected to reflect bundled-provision.

---

## Remaining for the PoC install (blocked on merchant access)

Once the `innobuilduk` dev store handle is in hand:

1. Update `.env.local` with `SHOPIFY_DEV_STORE=innobuilduk`
2. `shopify app dev` (or use Partner Dashboard test install on the dev store)
3. Verify `auth.callback.tsx` provisions cleanly — look for the `[automatos] provisioned ...` log line
4. Capture `workspace.public_id`, paste into `.env.local` as `COMPOSIO_ENTITY_ID`
5. `node --env-file=.env.local scripts/composio-resume.mjs` — should land at ACTIVE + green smoke tests
6. Add `widgets.automatos.app/v0` chat block to a duplicated theme on the dev store, confirm it loads + handshakes
7. Update `docs/SHOPIFY/CLIENTS.md` with the new merchant row
8. Capture any new gotchas in `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md`

---

## Known sharp edges

1. **Pre-existing TypeScript errors** in `app/routes/app._index.tsx`, `app.widgets._index.tsx`, `auth.login/route.tsx`, `shopify.server.ts` — version drift in `@shopify/polaris-icons` (`AnalyticsIcon` removed) and `@shopify/shopify-app-remix` future flags. Pre-dates this session's changes. Build still produces a working app; these are typecheck-only errors. Cleanup ticket worth opening before launch.
2. **`SHOPIFY_INTERNAL_API_KEY` is optional in dev** — orchestrator accepts unauthenticated calls if the key isn't configured. For production launch, set it both in the orchestrator config AND in `automatos-shopify` env as `AUTOMATOS_API_KEY`. Treat this as a launch checklist item.
3. **`stale Composio auth config `ac_wwcaUIBEt9bX`** still has 2 connections w/ 4 scopes. Don't delete until those are audited. Tracked in `CLIENTS.md`.
4. **The 1lovefragrance entity_id is a separate UUID** (`c71e4753-...`), not the workspace public_id. New merchants use `workspace.public_id` directly per the contract — no separate entity assignment.
5. **PRD-004 still requires a manual step** per merchant (running `composio-resume.mjs`). At App Store launch volumes, this becomes the bottleneck — closing PRD-004 is a P0 before public listing.

---

## Files touched this session

### Modified
- `app/automatos.server.ts` (rewritten to `/api/shopify/*` contract)
- `app/routes/auth.callback.tsx` (drop dead `seedAgents`, structured logging)
- `app/routes/webhooks.app.tsx` (`onOrderCreate` → `onShopifyEvent`)
- `scripts/composio-resume.mjs` (toolkit pin, smoke-test slugs)
- `scripts/composio-setup.mjs` (same)
- `scripts/composio-check.mjs` (same)
- `docs/ARCHITECTURE.md` (Flow I diagram + CDN URL)
- `docs/PRDS/PRD-004-UNIFIED-INSTALL-FLOW.md` (endpoint refs, current state)

### Created
- `docs/RUNBOOKS/client-onboarding.md`
- `docs/SHOPIFY/CLIENTS.md`

### Untouched (deliberately)
- `extensions/automatos-theme/blocks/*.liquid` — theme blocks reference `widgets.automatos.app/v0` correctly per the CDN cutover commit
- `prisma/schema.prisma` — no schema change needed for this work
- Orchestrator code — already serving the `/api/shopify/*` contract; PRD-004 closure happens upstream in `automatos-ai`
- `.env.local` — left pointing at `1lovefragrance` until we have the new dev store handle

---

## Quick sanity commands before next install attempt

```bash
# Confirm clean working tree
cd /Users/gkavanagh/Development/Automatos-AI-Platform/automatos-shopify
git status

# Confirm orchestrator endpoints alive
for p in /api/shopify/{provision,connect,deactivate,sync,events}; do
  curl -sS -o /dev/null -w "POST $p → %{http_code}\n" -X POST "https://api.automatos.app$p" \
    -H "Content-Type: application/json" -d '{}'
done
# Expect 422 on every line. 404 = orchestrator regression.

# Confirm CDN serves widget
curl -sS -o /dev/null -w "%{http_code}\n" https://widgets.automatos.app/v0/widget.js
# Expect 200 (or 304 with caching).

# Confirm Composio shared auth config still has 34 scopes
grep -oE 'read_[a-z_]+|write_[a-z_]+' shopify.app.toml | sort -u | wc -l
# Expect 34.
```
