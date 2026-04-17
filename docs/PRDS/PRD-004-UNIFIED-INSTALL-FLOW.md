# PRD: Unified Install Flow

**PRD ID:** SHOPIFY-004
**Status:** Draft
**Owner:** Gerard
**Date:** 2026-04-16
**Priority:** P1 — Unlocks self-serve onboarding for the App Store launch

---

## Problem

A merchant installing the Automatos app from the Shopify App Store today goes through **two OAuth flows** to get full functionality:

1. **Shopify App Store install.** Merchant clicks "Add app" → Shopify OAuth → lands on embedded app. Widgets available. `auth.callback.tsx` provisions the Automatos workspace, seeds agents, and stores the Shopify access token via `automatosClient.storeShopifyCredentials`.
2. **Composio connection.** Merchant has to separately log into the Automatos dashboard, navigate to Tools → Shopify → click Connect → go through Composio's hosted OAuth flow again → install the same app a second time. Only then do the 403 agent tools work.

This is fine for PoC and hand-held enterprise sales. It is a disaster for self-serve at scale — the second authorization requires the merchant to leave the Shopify admin, log into a separate product, and repeat an OAuth dance they've already done.

---

## Goal

Single Shopify App Store install = widgets ready AND agent tools wired. Zero dashboard interaction required unless the merchant wants to manage per-tool settings.

---

## Success Criteria

| Check | Pass condition |
|---|---|
| New merchant installs app from Shopify App Store | Yes |
| Automatos workspace created/linked | Automatic |
| Composio `connected_account` created | Automatic, in the same callback request |
| 403 Shopify tools available to agents | Immediately on redirect to `/app` dashboard |
| Merchant never visits `/tools` page to "connect" Shopify | Verified end-to-end on clean dev store |
| Re-install idempotent | Yes — does not duplicate workspace or connection |
| Existing merchants connected via the old two-step flow continue to work | Yes |

---

## Current state (important context)

This is largely built. Do not rewrite it.

**Already wired in `app/routes/auth.callback.tsx`:**
- Fetches shop metadata via GraphQL
- Calls `automatosClient.provisionWorkspace(session.shop, shopData)` — idempotent
- Calls `automatosClient.seedAgents(workspace.id)` — installs 9 Shopify agents
- Calls `automatosClient.storeShopifyCredentials(workspace.id, session.shop, session.accessToken)` — POSTs to orchestrator `/api/integrations/shopify/connect`

**The single remaining gap** is: the orchestrator's `/api/integrations/shopify/connect` endpoint currently stores the token locally (for server-to-server Admin API calls) but **does not register a Composio `connected_account` using that token**. That's the one missing step.

---

## Scope

### In scope
- Spike: confirm Composio SDK API for creating a `connected_account` from a pre-obtained OAuth access token (must happen before implementation)
- Extend orchestrator `/api/integrations/shopify/connect` to additionally call Composio with the imported token
- Store the resulting `connected_account_id` on the workspace row
- Handle existing-connection case (update vs duplicate)
- Handle re-install (revoke old `connected_account`? replace token? product decision)
- Update `/tools` UI to show Shopify as "Auto-connected" when imported via App Store path (vs "Connect" button when not yet linked)
- Verify SDK tool routing — `ComposioToolExecutor` calls succeed using the imported connected_account

### Out of scope
- UI for merchants to rotate or re-authorize the imported connection (deferred — they can disconnect + reinstall)
- Migration of existing two-step-flow merchants to imported-token model (they keep working; migration is voluntary)
- Multi-shop-per-workspace (one workspace = one Shopify store; covered by SHOPIFY-001)

---

## Spike result (2026-04-16, partial)

**Status:** partial — ran `scripts/composio-surface-probe.mjs` against live `@composio/core` SDK. Full token-exchange spike (`scripts/composio-token-import-spike.mjs`) still pending a test-store Shopify access token.

**SDK surface confirmed:**
- `composio.connectedAccounts` methods: `delete, disable, enable, get, initiate, link, list, refresh, update, updateStatus, waitForConnection`
- **`create()` does NOT exist.** The happy-path assumption in the original prerequisite spike (below) is invalid as written. We cannot hand Composio a pre-obtained token via `.create()`.

**Alternative paths to test tomorrow (in `composio-token-import-spike.mjs`):**
1. **`.link()`** — method name suggests "link an existing OAuth grant to a new connected_account". This is the most promising candidate for token import. Tomorrow's spike should introspect its signature via `composio.connectedAccounts.link.length` + a no-arg call (caught in try/catch, error message reveals required shape).
2. **`.update()`** — if a placeholder connection is first created via `.initiate()` without completing OAuth, `.update()` may accept credentials to flip status to ACTIVE.
3. **`.initiate()` with a credentials-bearing config** — worth a second look with the exact `OAUTH2` schema Composio expects; possible the `val` object accepts pre-obtained tokens.

**Confirmed existing auth config reusable:** `ac_iOROGtpG6qVR`, OAUTH2, 34 scopes, `isComposioManaged: false`, 4 connections already live. Scope list matches `shopify.app.toml` byte-for-byte (SHOPIFY-002 complete).

**Contingency if no silent-import path exists:** server-side invisible OAuth — orchestrator uses the still-authenticated Shopify session to auto-approve the Composio hosted flow in a server-to-server fetch (no browser redirect). More code, but transparent to merchant. Complexity estimate: ~150 LOC on orchestrator, ~1 day including tests.

---

## Prerequisite spike (do first)

**Before any code changes, verify:**

```python
# Pseudo-code — actual signature TBD by SDK inspection
composio.connected_accounts.create(
    user_id=workspace.public_id,
    auth_config_id="ac_iOROGtpG6qVR",
    credentials={
        "access_token": shopify_access_token,
        "shop": shop_subdomain,
    },
    status="ACTIVE",
)
```

If this works: implementation is ~50 lines on the orchestrator and a small type addition on the workspace model.

If this does not work (Composio SDK requires going through `.link()` or `.initiate()`): fall back to triggering a **silent** Composio OAuth flow from the orchestrator, using the already-authorized Shopify session to auto-approve. More complex, but still invisible to the merchant because Shopify remembers the grant.

Spike output: 1-page memo in this PRD's comments with the confirmed API shape and estimated LOC.

---

## Implementation plan (post-spike, assuming happy path)

### 1. Orchestrator changes

**File:** `automatos-ai/orchestrator/api/shopify.py`

Extend the existing `/api/integrations/shopify/connect` endpoint handler:

1. Store access token (as today — for direct Admin API fallback).
2. Call `composio_client.import_access_token(entity_id=workspace.public_id, auth_config_id=SHOPIFY_AUTH_CONFIG_ID, access_token=..., shop=...)`.
3. Persist returned `connected_account_id` on workspace (new column or JSON field).
4. Return both ids to caller so `auth.callback.tsx` can log them.

### 2. Workspace schema

Add `shopify_composio_connection_id VARCHAR NULLABLE` to workspace model. Migration.

### 3. `automatos-shopify` — `automatos.server.ts`

`storeShopifyCredentials` response type gains `composio_connection_id?: string`. No other changes required — the call signature stays the same.

### 4. `/tools` UI

**File:** `automatos-ai/frontend/components/tools/composio-apps-section.tsx`

When a workspace has `shopify_composio_connection_id` imported via App Store install, the Shopify card shows:
- Badge: `Connected` (green) — as today
- Footnote under the badge: "Auto-connected via Shopify install"
- `Manage` button still works (goes to per-tool settings)
- `Disconnect` behaviour unchanged

### 5. Re-install handling

When `/api/integrations/shopify/connect` fires for a shop that already has a `shopify_composio_connection_id`:
- If stored `connected_account` still ACTIVE in Composio → update token in place (Composio supports credential rotation), no new connection created
- If stale / FAILED → delete old, create new

---

## Risks

| Risk | Mitigation |
|---|---|
| Composio SDK doesn't expose a token-import path | Spike first. Fallback to silent-OAuth flow (see Prerequisite spike). |
| Composio rate limits on `connected_accounts.create` | Low concern for single-digit installs/minute; monitor when app store listing goes live |
| Access token rotation (Shopify reissues tokens) | Set up webhook for `shop/update` and refresh Composio connection token when Shopify does |
| Workspace ↔ shop lookup ambiguity | Idempotency key = shop domain; single workspace per shop enforced in DB |
| Merchant uninstalls and reinstalls from a different Shopify user | Existing `provisionWorkspace` idempotency handles this if keyed on shop domain, not user email |

---

## Open product question

**When a brand-new merchant (no Automatos account) installs the app, what happens?**

Options:

- **Auto-provision.** Install creates workspace + sends magic-link email for dashboard login. Fastest UX. Highest conversion. Weak if merchant already has an Automatos account under a different email.
- **"Link or sign up" screen.** After install, merchant chooses "I have an Automatos account / Sign me up for Automatos". Handles both cases. Adds one click.
- **Pre-registration required.** Merchant must have an Automatos account before install. App Store listing sends them to Automatos signup first. Highest friction; lowest conversion; best for enterprise.

**This decision blocks merging this PRD.** Make the call before writing code — changes the orchestrator workspace-provision logic materially.

Default recommendation: **auto-provision with magic-link**. Fastest to ship, easiest to reverse.
