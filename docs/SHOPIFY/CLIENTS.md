# Automatos Shopify — Client Registry

**Purpose:** single source of truth for which merchants are connected, their Automatos workspace IDs, and their Composio connection IDs. Use this when debugging, billing, or tracking down a specific merchant's state.

**Update rule:** add a row when a merchant is provisioned (Step 2 of `docs/RUNBOOKS/client-onboarding.md`). Mark `status` as `poc` until widgets are live on a published theme, then `live`. Mark `archived` if the merchant uninstalls.

---

## Active merchants

| Shop domain | Workspace public_id | Composio connected_account | Entity ID | Install date | Tier | Status | Notes |
|---|---|---|---|---|---|---|---|
| `1lovefragrance.myshopify.com` | _(see Composio dashboard for c71e4753-...)_ | `ca_hV499ZT66IGB` | `c71e4753-97ad-4d52-bfa0-f2a90c0a384b` | 2026-04-12 | starter | `poc` | Original PoC merchant. Widgets tested end-to-end via CDN cutover. |
| `innobuilduk.myshopify.com` | _(pending)_ | _(pending)_ | _(pending)_ | _(pending)_ | starter | `awaiting-access` | Waiting on dev store access from merchant. PoC only — not touching live. |

---

## Archived / decommissioned

_(none)_

---

## How to fill a row

When you add a new merchant:

1. **Shop domain** — fully qualified, including `.myshopify.com`
2. **Workspace public_id** — UUID returned by `POST /api/shopify/provision` (also `id`; they're equal)
3. **Composio connected_account** — `ca_*` from the smoke test in `composio-resume.mjs` output
4. **Entity ID** — the `COMPOSIO_ENTITY_ID` you used (currently the same as workspace public_id; was a separate UUID for `1lovefragrance` because it predates the public_id convention)
5. **Install date** — ISO `YYYY-MM-DD` of the day the Partner app was installed
6. **Tier** — `starter` / `growth` / `enterprise` (from PRD-006 tier table)
7. **Status** — `awaiting-access` / `poc` (installed, not on published theme) / `live` (widgets in production theme) / `archived` (uninstalled)
8. **Notes** — anything operationally relevant: known scope quirks, testing constraints, custom integration work

---

## Shared infrastructure (one entry, applies to all merchants)

| Item | Value |
|---|---|
| Composio auth config | `ac_iOROGtpG6qVR` |
| Toolkit version | `20260414_00` |
| Widget CDN | `https://widgets.automatos.app/v0/` |
| Orchestrator API | `https://api.automatos.app` |
| Partner app client_id | `f184b73f2d841c1972744565325d3548` |

---

## Stale auth configs (do NOT delete without checking)

| ID | Status | Notes |
|---|---|---|
| `ac_wwcaUIBEt9bX` | stale, has 2 connections w/ 4 scopes | Pre-PoC API_KEY-style auth config. Not used by any current merchant. Leave until we audit those 2 connections. |
