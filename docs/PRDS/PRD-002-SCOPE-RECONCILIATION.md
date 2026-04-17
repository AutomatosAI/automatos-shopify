# PRD: Partner App Scope Reconciliation

**PRD ID:** SHOPIFY-002
**Status:** Draft
**Owner:** Gerard
**Date:** 2026-04-16
**Priority:** P0 — Blocks next `shopify app deploy` without a merchant re-auth cascade

---

## Problem

`shopify.app.toml` declares **9 access scopes**. The Composio auth config (`ac_iOROGtpG6qVR`) and its creation script (`scripts/composio-setup.mjs`) request **30+ scopes**. The Partner app's current release was pushed through Composio's custom OAuth flow and therefore carries the 30+ scope set, but the TOML is the source of truth that `shopify app deploy` will use next.

**Concrete risk:** the next time anyone runs `shopify app deploy` from this repo, the Partner app release will regress to 9 scopes. Shopify treats this as a scope downgrade, which:

1. Breaks any agent tool call relying on the dropped scopes (e.g., `read_inventory`, `read_themes`, `write_discounts`, `read_locations`).
2. Forces every connected merchant to re-authorize the app before tools work again (your own Gotcha #6 in `COMPOSIO-SHOPIFY-SETUP.md`).
3. Can silently fail — agent errors look like API permission issues, not a deploy regression, so diagnosis is slow.

---

## Goal

Bring `shopify.app.toml` into agreement with the Composio auth config's scope list so that any future `shopify app deploy` is a no-op from a permissions standpoint.

---

## Success Criteria

| Check | Pass condition |
|---|---|
| TOML scope count | Matches `FULL_SCOPES` array in `scripts/composio-setup.mjs` |
| `shopify app deploy --dry-run` | Reports no scope change for the next release |
| Dev store consent screen | Shows the full 30+ scope list when re-installing the app |
| Existing `1lovefragrance` connection | Remains ACTIVE, smoke test still passes |
| New dev-store install | Connects successfully with full scopes |

---

## Scope

### In scope
- Update `shopify.app.toml` scope list to match `scripts/composio-setup.mjs`
- Verify via `shopify app config push` (or equivalent) that the TOML is ingested correctly
- Cut a new Partner app release, confirm dev-store consent screen renders full list
- Update `COMPOSIO-SHOPIFY-SETUP.md` to point to `shopify.app.toml` as the canonical scope source (currently the setup doc lists scopes inline — risk of future drift)

### Out of scope
- Adding/removing any individual scope from the canonical list (that is a separate product decision if it ever comes up)
- Changes to `scripts/composio-setup.mjs` — that script stays the authoring tool for the Composio auth config
- Webhook topic changes

---

## Implementation plan

### 1. `shopify.app.toml`

Replace the current 9-scope line:

```toml
scopes = "read_products,write_products,read_orders,read_customers,read_inventory,write_inventory,read_content,write_content,read_themes"
```

with the full 30+ scope list from `scripts/composio-setup.mjs` `FULL_SCOPES` array. Preserve comma-separated, no newlines (Shopify TOML requirement).

### 2. Deploy + verify

1. `shopify app config push`
2. `shopify app deploy` — bump app version, create release
3. Visit dev store install URL, confirm consent screen displays full scope list
4. Run `node --env-file=.env.local scripts/composio-check.mjs` — confirm existing `ca_hV499ZT66IGB` still ACTIVE and smoke test returns products

### 3. Documentation update

Update `docs/SHOPIFY/COMPOSIO-SHOPIFY-SETUP.md` Step 1a to reference the TOML as canonical instead of inlining the list. Add a note: "If you change scopes here, update `shopify.app.toml` in the same PR."

---

## Risks

| Risk | Mitigation |
|---|---|
| Release creates a scope-change notification for connected merchants | Expected — since Composio already pushed these scopes, merchants already granted them. Shopify may still show a "scopes changed" banner once; benign. |
| TOML syntax error breaks `shopify app deploy` | Run `shopify app config validate` before push |
| Accidentally add a new scope while copying | Diff against `FULL_SCOPES` array byte-for-byte; paste from script, not memory |

---

## Open questions

- Does Shopify rate-limit scope updates on a Partner app? If so, batch any future additions rather than doing several small releases.
- Should we delete `read_themes` if we're not using theme writes? Lower scope = better App Store review. Leave decision for a separate scope-pruning PRD.
