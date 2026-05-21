# PRD-008-A — Deploy + Smoke-Test Runbook

**Date:** 2026-05-14
**For:** Whoever's deploying PRD-008-A end-to-end
**Estimated time:** 30-45 minutes

What you're verifying: Sites foundation + Feature B (callback) + Feature C1
(cart-idle) work end-to-end across orchestrator → SDK → theme → dashboard.

---

## Branches that need to merge (in this order)

| Order | Repo | Branch | Adds |
|---|---|---|---|
| 1 | `automatos-ai` | `feat/prd-008-a-sites-foundation` | Sites table + API + callback endpoint + dispatchers + telemetry + i18n + dashboard UI |
| 2 | `automatos-widget-sdk` | `feat/prd-008-a-cart-idle-callback` | Cart-idle trigger + callback form + `openCallbackForm()` API |
| 3 | `automatos-shopify` | `docs/install-flow-walkthrough` | PRDs + this runbook (no theme/code change required) |

---

## Pre-deploy checklist

### 1. SMTP env vars on Railway (one-time)

Without these, every email destination dispatch fails permanently.

```
SMTP_HOST=smtp.sendgrid.net   # or your relay
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<secret>
SMTP_FROM=callbacks@automatos.app
```

Add via Railway dashboard → Variables. **Don't commit secrets.**

### 2. Confirm DB migration target

The orchestrator branch adds two migrations:

```
prd008a_sites              # creates sites + backfills from workspace.settings
prd008a_widget_event_log   # creates widget_event_log
```

The codebase has many parallel alembic heads (pre-existing). Check
the chain:

```bash
cd orchestrator && alembic heads | grep prd008a
# Expect: prd008a_widget_event_log (head)
```

Plan to run `alembic upgrade prd008a_widget_event_log` after the
deploy, **before** serving traffic.

---

## Deploy order

### Step 1 — Orchestrator (Railway)

1. Merge PR `automatos-ai/feat/prd-008-a-sites-foundation` to main.
2. Railway auto-builds + deploys.
3. **STOP** — don't restart the service yet.
4. Open Railway shell:
   ```bash
   cd orchestrator && alembic upgrade prd008a_widget_event_log
   ```
   Expect both tables created + every existing workspace gets a default Site.
5. Restart the Railway service to pick up new routers.
6. Run Tier 1 smoke tests (below) before going further.

### Step 2 — Widget SDK (CDN)

1. Merge PR `automatos-widget-sdk/feat/prd-008-a-cart-idle-callback` to main.
2. From the SDK repo:
   ```bash
   pnpm install && pnpm -r build
   ./scripts/deploy-cdn.sh
   ```
3. Verify the new bundle is live:
   ```bash
   curl -sI https://widgets.automatos.app/v0/widget.global.js | grep -E "etag|last-modified"
   ```
   The `last-modified` should be within the last 5 minutes.
4. The theme block already pins `widgets.automatos.app/v0/...` so no
   theme deploy is needed — every storefront picks up v0.3.0
   automatically on next page load.

### Step 3 — Shopify docs (no deploy, just merge)

1. Merge PR `automatos-shopify/docs/install-flow-walkthrough` to main.
2. No theme deploy needed — the chat-widget block is unchanged.

---

## Tier 1 — Backend smoke (after Step 1)

Set up env vars for the curl commands:

```bash
export RAILWAY=https://api.automatos.app
export WS_API_KEY="ak_pub_xxx"          # an existing public widget key
export USER_JWT="$YOUR_AUTOMATOS_LOGIN_JWT"   # for /api/sites
```

### 1.1 PRD-007 still works (no regression)

```bash
curl -s "$RAILWAY/api/widgets/config" -H "Authorization: Bearer $WS_API_KEY" | jq
```

Expect `{"workspace_id":"…","config":{"widget_proactive":{…}}}`. This is the
resolver fallback from Phase 3 in action — Site is now the source of truth,
workspace.settings is only a transition-window safety net.

### 1.2 Sites API — list (verify backfill ran)

```bash
curl -s "$RAILWAY/api/sites" -H "Authorization: Bearer $USER_JWT" | jq
```

Expect at least 1 Site for your workspace. If empty, the migration
backfill didn't run — STOP and investigate.

```bash
export SITE_ID=$(curl -s "$RAILWAY/api/sites" -H "Authorization: Bearer $USER_JWT" | jq -r '.sites[0].id')
echo "Site: $SITE_ID"
```

### 1.3 Enable callback feature on the Site

```bash
curl -s -X PATCH "$RAILWAY/api/sites/$SITE_ID/settings" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "callback": {
        "enabled": true,
        "destinations": [{"type":"email","address":"YOU@example.com"}],
        "sla_hours": 4,
        "team_capacity": "limited",
        "working_hours_only": false,
        "rate_limit_per_hour": 100
      }
    }
  }' | jq '.settings.callback.enabled'
```

Expect `true`. **Replace `YOU@example.com` with a real inbox you can check.**

### 1.4 Submit a callback (the big one)

```bash
curl -s -X POST "$RAILWAY/api/widgets/callback" \
  -H "Authorization: Bearer $WS_API_KEY" -H "Content-Type: application/json" \
  -d '{"session_id":"smoketest1","phone":"+447700900123","name":"Smoke Test","product_context":"Test panel"}' | jq
```

Expect:
```json
{
  "accepted": true,
  "request_id": "cb_xxx",
  "eta_phrase": "We'll aim to call you within 4 working hours about the Test panel."
}
```

Within ~30s, **check `YOU@example.com`** — you should receive an email with
the callback details. If no email arrives, check Railway logs for
`callback_failed` and verify SMTP env vars.

### 1.5 Idempotency

Re-run 1.4 within 5 minutes — same `request_id` returns, no second email arrives.

### 1.6 Rate limit

Run 1.4 a second time within 60s with same `session_id` (different phone):

```bash
curl -s -X POST "$RAILWAY/api/widgets/callback" \
  -H "Authorization: Bearer $WS_API_KEY" -H "Content-Type: application/json" \
  -d '{"session_id":"smoketest1","phone":"+447700900124","name":"Test 2"}' -i | head -2
```

Expect `HTTP/2 429` with `Retry-After: 60`.

### 1.7 Telemetry

In the orchestrator DB:

```sql
SELECT event_type, event_data->>'request_id' as req, created_at
FROM widget_event_log
WHERE site_id = '<SITE_ID>'
ORDER BY created_at DESC LIMIT 10;
```

Expect rows for `callback_requested` + `callback_delivered` (or
`callback_failed` with an error reason).

### 1.8 Validation guards

```bash
# Bad phone → 400
curl -s -X POST "$RAILWAY/api/widgets/callback" \
  -H "Authorization: Bearer $WS_API_KEY" -H "Content-Type: application/json" \
  -d '{"session_id":"x","phone":"not a phone","name":"X"}' -i | head -2
# Expect HTTP/2 400 with "E.164" in detail

# Feature-gate (turn off + re-call) → 403
# (re-PATCH to enabled:false, then submit, expect 403, re-enable)
```

---

## Tier 2 — Storefront smoke (after Step 2 — SDK deploy)

Open a storefront on a Shopify store with the Automatos chat widget installed
(e.g. `besafe-ltd.myshopify.com` or INBUILD UK).

### 2.1 Existing PRD-007 still works

Open a product page → wait 20s → product-page proactive popup fires.
**No regression** — same as before.

### 2.2 Cart-idle trigger fires

1. Enable cart_idle on the Site:
   ```bash
   curl -s -X PATCH "$RAILWAY/api/sites/$SITE_ID/settings" \
     -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
     -d '{"settings":{"cart_idle":{"enabled":true,"idle_seconds":15,"greeting":"Need help with your order?","frequency_cap":{"scope":"session","max_pops":1}}}}'
   ```
   (15s instead of 90s for faster smoke testing.)
2. Visit storefront `/cart` (any cart with items).
3. **Don't move the mouse for 15s.**
4. Cart-idle popup fires with the configured greeting.
5. Sanity check console: `[automatos.cart_idle] firing`.

### 2.3 Callback form opens via global API

Open browser devtools console on any storefront page:

```javascript
window.AutomatosWidget.openCallbackForm({
  product_context: "EN 12101 panel",
  onSuccess: (r) => console.log("✅ submitted:", r),
});
```

Expect:
- Form pops bottom-right
- Submit with valid +447... number → form transitions to "Thanks!" state
  with the eta_phrase
- Email arrives at the configured destination within ~30s
- Console logs the request_id
- A new `callback_requested` row appears in `widget_event_log`

### 2.4 XSS guard (security regression check)

```javascript
window.AutomatosWidget.openCallbackForm({
  heading: '<img src=x onerror="alert(1)">',
});
```

Expect the form to render the literal string as text in the heading — no alert
fires, no `<img>` element in the DOM.

---

## Tier 3 — Dashboard smoke (no deploy needed; same Step 1)

The dashboard frontend ships with the orchestrator deploy.

1. Log into the Automatos dashboard → navigate to `/admin/sites`.
2. Confirm the Site list shows your auto-provisioned Sites.
3. Click into the Site → "Destinations" tab.
4. Add a Slack webhook destination, save.
5. Submit a callback (Tier 1.4) → confirm Slack channel receives the message
   within ~30s.
6. Visit "Widget" tab → toggle Cart-idle, edit greeting, save.
7. Refresh storefront → verify the greeting changed.
8. **Shopify tab** (Shopify Sites only): "Open theme editor" link works,
   capability matrix shows expected `has_*` flags.

---

## Rollback

| Layer | Symptom | Action |
|---|---|---|
| Orchestrator | Migration corrupted data | DON'T `alembic downgrade` (data loss). Revert code; tables stay dormant. PRD-007 keeps working via resolver fallback. |
| Orchestrator | Endpoint behaviour wrong | `git revert` the offending commit, redeploy. Tables stay (no harm). |
| SDK | Form / cart-idle breaks something | Pin theme to previous CDN version OR push a fix-forward to the v0 channel. |
| Frontend | Sites dashboard panel broken | `git revert` frontend code; merchants fall back to PATCH. |

---

## Stopping conditions

If any of these happen, halt and investigate before continuing:

- Migration backfill produces 0 Sites (Sites API returns empty)
- PRD-007 widget regression (existing proactive popup stops firing)
- Callback returns 202 but no email/Slack/CRM dispatch in 60s and
  `widget_event_log` shows no `callback_failed` either
- Form opens but submit hangs > 30s (timeout misconfigured)
- Frontend dashboard `/admin/sites` returns 404 (route not deployed)

---

## Post-smoke

Once Tiers 1-3 pass:

1. Onboard INBUILD UK as the PoC client — they're the first real-world Site
   with callback enabled.
2. Watch `widget_event_log` rollup for the first week.
3. PRD-008-B (cross-sell + bulk pricing) and PRD-009 Layer 2 (catalog graph)
   un-park.
