# PRD-008-A: Human Handoff + Sites Foundation

**PRD ID:** SHOPIFY-008-A
**Status:** Draft v0.1 — ready for engineering scoping
**Owner:** Gerard
**Date:** 2026-05-14
**Priority:** P1 — first PRD built for 4.6M-merchant scale rather than INBUILD UK alone. Lays the universal foundation every future channel inherits.

**Replaces / supersedes:** the "Feature B + C1" portions of `PRD-008-CALLBACK-AND-CART-FEATURES.md`. The remaining "Feature C2 + C3" portion is recast as PRD-008-B and deferred until PRD-009 Layer 2 lands.

**Related work:**
- PRD-007 (Proactive Engagement) — shipped. This PRD extends the engine with `/cart` page-type + new trigger.
- PRD-008-B (Cart Commerce Intelligence) — deferred. Cross-sell + bulk pricing depend on the catalog knowledge graph (PRD-009 Layer 2).
- PRD-009 (Product Knowledge Grounding) — parked. Resumes after PRD-008-A is solid.

---

## Why this PRD exists

PRD-007 shipped a proactive popup engine. INBUILD UK is the PoC client. The market we're building for is 4.6M Shopify merchants — plus every future Wix / WooCommerce / custom-site integration. The original PRD-008 was scaffolded around INBUILD UK's specific asks with 11 `[OPEN]` markers waiting for *their* answers. That doesn't scale.

This PRD reframes the work around three pillars:

1. **A universal Sites architecture.** Today the Automatos dashboard has zero per-merchant integration UI. Whatever we build for the first integration becomes the template for every future one. We have one chance to make the pattern reusable.
2. **Two genuinely universal features** layered on top: human callback handoff (Feature B) and cart-idle proactive engagement (Feature C1). Both work for any merchant, on any future channel that has the relevant capability.
3. **Defensible defaults for everything**, so a merchant can install Automatos, click two buttons, and have a working conversion engine — without answering eleven configuration questions first.

The pitch to clients: *"Connect your Shopify store. We pick sensible defaults. You override anything from your dashboard or directly in your Shopify theme editor. No developer needed at any step."*

---

## Goal

**Architectural shift**: introduce **Sites** as the first-class unit of integration in the Automatos dashboard. A Site is *anywhere the widget runs*. Today that's a Shopify store; tomorrow Wix, WooCommerce, custom embeds. All per-merchant widget settings hang off a Site, not the workspace. A workspace can have 1..N Sites.

**Feature work** built on top:
- **B. Callback handoff** — universal across all Site types. Shopper asks for a phone callback; widget captures phone + name + context; payload routed to merchant-nominated destination(s) via async dispatch; bot phrases the SLA honestly based on working hours + capacity.
- **C1. Cart-idle proactive** — Site-capability-gated (`has_cart`). Extends PRD-007's trigger engine to recognize `/cart` page-type and a new `idle_on_cart` trigger.

**Sellable outcome**: a merchant goes from "installed but silent" to "two new revenue surfaces live" in under five minutes of dashboard clicks.

---

## Architectural pillar: Sites, not Shopify

### The hierarchy

```
Workspace            (the Automatos customer's account — Stripe billing entity, team members)
 └── Site            (one connected surface where the widget lives)
      ├── Shopify     (besafe-ltd.myshopify.com)
      ├── Wix         (futureclient.wixsite.com)            [future]
      ├── WooCommerce (acmeinc.com/woocommerce)             [future]
      └── Custom      (raw <script> embed on acmeinc.com)   [future]
```

A workspace can have 1..N Sites. An agency managing 5 Shopify stores has 1 workspace + 5 Sites. A merchant adding a Wix landing page next to their Shopify has 1 workspace + 2 Sites. A pure SaaS embed customer has 1 workspace + 1 Site of type `custom`.

### Why this matters

- **Settings live where they're scoped.** `widget_proactive`, `callback`, `cart_idle` are per-Site. Two Shopify stores under one workspace can have independent settings.
- **Channel-specific surface area stays isolated.** Shopify-only UI (theme block deeplink, scope status, sync state) lives in a Shopify tab on the Site page. The universal UI (widget settings, destinations) lives in shared tabs and works for any Site type.
- **Future channels become a 2-day adapter.** Adding Wix means: a new `SiteAdapter` class, an OAuth handshake, a few capability flags. Not a fresh dashboard.

### Existing `ChannelConnection` is unrelated

`orchestrator/core/models/channels.py` already defines `ChannelConnection` for messaging platforms (Telegram / Slack / Discord — where conversations can happen). That's a different concept and stays as-is. The naming overlap is unfortunate but isolatable: **Sites** = where the widget runs, **Channels** = messaging platforms, **Destinations** = where callback leads land.

### Site capabilities pattern

Each Site exposes a typed `capabilities` block. Universal UI components render conditionally based on capabilities — no Shopify-specific branching in shared components.

```typescript
// frontend/lib/sites/types.ts
export type SiteCapabilities = {
  has_cart: boolean;                  // Shopify: true. Custom embed: false.
  has_catalog: boolean;               // Shopify: true. Custom: false.
  has_volume_discounts: boolean;      // Shopify with price rules: true.
  has_customer_records: boolean;
  has_working_hours_source: boolean;  // Shopify exposes shop.timezone — we use it instead of asking.
  supports_theme_override: boolean;   // Shopify theme block: true. Custom: false.
};
```

Examples of conditional rendering:
- **CartIdlePanel**: renders only if `has_cart`.
- **WorkingHoursEditor**: pre-fills from Shopify `shop.timezone` if `has_working_hours_source`; otherwise asks the merchant.
- **ThemeBlockDeeplink**: only on the Shopify-specific tab, only if `supports_theme_override`.

---

## Scope

### In scope (PRD-008-A)

1. **Sites data model + migration**
   - New `sites` table (1:N workspace → sites).
   - Existing `workspace.settings.widget_proactive` migrated to `sites.settings.widget_proactive` on a default auto-created Site per existing workspace.
   - All call sites updated (orchestrator, widget config endpoint, session token endpoint).

2. **Sites dashboard hub**
   - `/admin/sites` — list view (any type).
   - `/admin/sites/connect` — picker for Site type, Shopify wired (others stubbed).
   - `/admin/sites/[siteId]` — overview tab (status, last activity, telemetry summary).
   - `/admin/sites/[siteId]/widget` — universal widget settings (Proactive, Callback, Cart-idle).
   - `/admin/sites/[siteId]/destinations` — destinations CRUD.
   - `/admin/sites/[siteId]/shopify` — Shopify-specific tab (theme deeplink, scope status, sync state).

3. **Feature B — Callback handoff**
   - Phone-capture form in chat-widget (E.164 validation, name required, product context auto-filled from `pageContext`).
   - `POST /api/widgets/callback` endpoint → returns 202 + `{accepted: true, eta_phrase}` synchronously; dispatches to destinations on Redis queue.
   - Destinations: `email | slack_webhook | crm_webhook | shopify_customer_note`. Generic webhook only — no native CRM connectors in v1.
   - Working hours support (timezone-aware, per-day, defaults from `shop.timezone` if Site has `has_working_hours_source`).
   - Capacity-aware phrasing (`team_capacity: limited | normal` softens "we'll" → "we'll aim to").
   - Delivery confirmation surfaced in dashboard ("destination active — last delivery 12s ago" vs "destination failed — webhook 500").

4. **Feature C1 — Cart-idle proactive**
   - New trigger type `idle_on_cart` in widget SDK.
   - `/cart` added to allowed `page_types` (Site capability gate: `has_cart`).
   - Cart-aware greeting variant; reuses PRD-007 frequency cap + dismissal logic.
   - Cart context (`cart_item_count`, `cart_total`, cart line items JSON) flows through `pageContext`.

5. **Cross-cutting infrastructure**
   - `WidgetEventLog` table + telemetry write helper following PRD-139 pattern.
   - Async dispatch via existing Redis queue (`orchestrator/core/task_runner/queued.py`).
   - Idempotency on `POST /callback` (dedupe on `{session_id, phone, 5-min-window}`).
   - Rate limits: per-session (1 callback / 60s), per-IP (10 / hour), per-Site (configurable, default 100 / hour).
   - GDPR: phone forwarded to destinations, NOT persisted in Automatos beyond transcript; encrypted at rest; default 30-day transcript retention, merchant-overridable.
   - i18n: en-GB at launch; all user-facing strings via locale resolver; fr/de/en-US/es scaffolded for next release.

### Out of scope (deferred)

- **PRD-008-B (Cart Commerce Intelligence)** — Feature C2 (cross-sell) + C3 (bulk pricing). Both depend on PRD-009 Layer 2 catalog knowledge graph. Building them without it produces fabricated suggestions — the exact problem PRD-009 was written to solve.
- **Native CRM connectors** (HubSpot, Salesforce, Pipedrive) — generic webhook only in v1; native connectors per-PRD when demand is concrete.
- **SMS notifications to merchant team** when a callback arrives — destinations send to merchant inboxes/channels; SMS is a future destination type.
- **A/B testing infrastructure** for callback phrasing or cart-idle greetings — single variant per Site for v1.
- **Server-driven personalization** based on shopper history (RFM, lifetime value) — anonymous sessions only in v1.
- **Inbox view in dashboard** for callbacks (search, filter, mark-resolved) — v1 logs to destinations; v2 adds an Automatos-side inbox if merchants ask.
- **Site-level agent customization** per Site (different persona / skill set per Site under one workspace) — v1 assumes one agent per workspace shared across Sites.
- **Bulk Site import** for agencies onboarding 50+ stores — v1 supports one-at-a-time; bulk import is a future PRD.

---

## Data model

### `sites` table (new)

```sql
CREATE TABLE sites (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,           -- 'shopify' | 'wix' | 'woocommerce' | 'custom'
  external_id     TEXT,                    -- Shopify: shop_domain. Custom: null.
  display_name    TEXT NOT NULL,           -- "INBUILD UK" or "besafe-ltd.myshopify.com"
  status          TEXT NOT NULL DEFAULT 'active',  -- active | paused | disconnected | error
  settings        JSONB NOT NULL DEFAULT '{}',     -- widget_proactive, callback, cart_idle blocks
  capabilities    JSONB NOT NULL DEFAULT '{}',     -- has_cart, has_catalog, etc.
  secrets         JSONB,                           -- encrypted: shopify_access_token, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (workspace_id, type, external_id)
);

CREATE INDEX idx_sites_workspace_id ON sites(workspace_id);
CREATE INDEX idx_sites_type_external ON sites(type, external_id);
```

### `widget_event_log` table (new — telemetry)

Follows PRD-139 `ToolExecutionLog` pattern.

```sql
CREATE TABLE widget_event_log (
  id              BIGSERIAL PRIMARY KEY,
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  session_id      TEXT,
  event_type      TEXT NOT NULL,           -- callback_requested, callback_delivered, callback_failed,
                                           -- cart_idle_fired, cart_idle_dismissed,
                                           -- proactive_fired, proactive_dismissed
  event_data      JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_event_log_site_created ON widget_event_log(site_id, created_at DESC);
CREATE INDEX idx_widget_event_log_type_created ON widget_event_log(event_type, created_at DESC);
```

### Migration plan (from current `workspace.settings`)

```
1. CREATE TABLE sites
2. For each existing workspace W:
     - Read W.settings.shopify_domain (if present → type='shopify', external_id=domain)
       OR default to type='custom', external_id=null
     - INSERT sites (workspace_id=W.id, type=..., external_id=..., display_name=...,
                    settings={widget_proactive: W.settings.widget_proactive},
                    capabilities=derive_from_type(type),
                    secrets={shopify_access_token: W.settings.shopify_access_token})
3. Update all orchestrator code paths reading workspace.settings.widget_proactive
   to instead resolve a Site (default: first Site for the workspace) and read site.settings.widget_proactive.
4. Update GET /api/widgets/config to resolve Site via the public API key → Site mapping.
5. Update SessionTokenResponse to include site_id alongside workspace_id.
6. Migration runs idempotently — safe to re-run.
```

### Configuration shape (`site.settings` JSONB)

```jsonc
{
  "widget_proactive": {
    // PRD-007 fields — unchanged
    "enabled": false,
    "page_types": ["product"],
    "triggers": [{ "type": "time_on_page", "seconds": 20 }],
    "frequency_cap": { "scope": "session", "max_pops": 1 },
    "greeting_source": "agent_with_canned_fallback",
    "canned_fallback": "Need a hand finding the right product?",
    "agent_timeout_ms": 30000,
    "popup_style": "corner_bubble",
    "respect_consent": true,
    "dismissal_persistence": "session"
  },
  "callback": {                            // PRD-008-A Feature B
    "enabled": false,
    "destinations": [],                    // see destination shapes below
    "fields": {
      "phone_required": true,
      "name_required": true,
      "urgency_optional": false,
      "preferred_time_optional": false
    },
    "working_hours_only": true,
    "working_hours": {
      "tz": "Europe/London",               // pre-filled from shop.timezone if has_working_hours_source
      "monday":    { "start": "09:00", "end": "17:00" },
      "tuesday":   { "start": "09:00", "end": "17:00" },
      "wednesday": { "start": "09:00", "end": "17:00" },
      "thursday":  { "start": "09:00", "end": "17:00" },
      "friday":    { "start": "09:00", "end": "17:00" },
      "saturday":  "closed",
      "sunday":    "closed"
    },
    "sla_hours": 4,                        // populates the SLA phrase template
    "team_capacity": "limited",            // limited softens phrasing
    "intent_phrases": [                    // trigger callback flow on these
      "speak to someone", "call me back", "talk to a human", "phone me", "tech support"
    ],
    "rate_limit_per_hour": 100             // per-Site
  },
  "cart_idle": {                            // PRD-008-A Feature C1
    "enabled": false,
    "idle_seconds": 90,
    "greeting": "Any questions before you check out?",
    "frequency_cap": { "scope": "session", "max_pops": 1 }
  }
}
```

### Destination shapes

```jsonc
[
  { "type": "email", "address": "sales@example.com" },
  { "type": "slack_webhook", "url": "https://hooks.slack.com/...", "channel_label": "#leads" },
  { "type": "crm_webhook", "url": "https://...", "auth_header": "Bearer ..." },
  { "type": "shopify_customer_note" }      // only available on Shopify-type Sites
]
```

---

## Replacing the 11 `[OPEN]` items with defaults

| Original `[OPEN]` | "4.6M scale" answer |
|---|---|
| B1 destination | Support all 4. **Default**: email to `shop.email` (Shopify Admin API) for Shopify Sites; merchant fills in for non-Shopify. |
| B2 working hours | Full per-day + tz editor. **Default**: pre-fill from `shop.timezone`, 09:00–17:00 Mon–Fri, weekends closed. |
| B3 SLA phrasing | Template `"We'll aim to call you within {sla_hours} working hours"`. **Default `sla_hours = 4`**. `team_capacity = limited` softens "we'll" → "we'll aim to". |
| B4 fields captured | Phone (required), name (required), product context (auto). Urgency + preferred-time **off by default**, merchant toggle. |
| C1.a idle threshold | Merchant-configurable. **Default 90s**. Telemetry from day one so we can revisit with data. |
| C1.b greeting tone | Single editable text field. **Default**: `"Any questions before you check out?"` (neutral, no pressure). |
| C2.a recommendation source | **DEFERRED — PRD-008-B.** |
| C2.b in-chat vs separate widget | **DEFERRED — PRD-008-B.** |
| C2.c max suggestions | **DEFERRED — PRD-008-B.** |
| C3.a does merchant have bulk pricing | **DEFERRED — PRD-008-B.** |
| C3.b automatic vs code-based bulk | **DEFERRED — PRD-008-B.** |

---

## Dashboard hub — UI specification

### Routes

```
/admin/sites                                ← Sites list
/admin/sites/connect                        ← "What do you want to connect?" picker
/admin/sites/connect/shopify                ← Shopify OAuth start
/admin/sites/connect/custom                 ← Script-tag embed instructions (v1 second-class)
/admin/sites/[siteId]                       ← Overview tab
/admin/sites/[siteId]/widget                ← Universal widget settings
/admin/sites/[siteId]/destinations          ← Destinations CRUD
/admin/sites/[siteId]/shopify               ← Shopify-only tab (renders only if type=shopify)
```

### Universal components (used by any Site type)

- **SitesList** — table view of all Sites, filterable by type/status.
- **SiteOverview** — status pills, last activity, 7-day telemetry summary, quick toggles.
- **WidgetSettingsShell** — wraps the three sub-panels with a save bar.
- **ProactivePanel** — PRD-007 fields. Already partially modeled in the theme block; this is the dashboard version.
- **CallbackPanel** — toggle + destinations link + working hours editor + SLA hours + capacity + intent phrases.
- **CartIdlePanel** — toggle + idle seconds + greeting (renders only if `capabilities.has_cart`).
- **DestinationsPanel** — list + add (typed: email, Slack, CRM webhook, Shopify customer note) + "test send" button per destination + live status pill.
- **WorkingHoursEditor** — timezone picker + per-day open/closed/range. Pre-fills from `capabilities.has_working_hours_source` data.
- **TelemetrySummary** — 7-day rollup from `widget_event_log`: callbacks requested/delivered/failed, cart-idle fire rate, proactive dismiss rate.

### Channel-specific components

- **ShopifyChannelTab** — `ThemeBlockDeeplink` ("Open theme editor"), `ScopeStatus` (granted Composio scopes), `SyncStatus` (catalog sync state — placeholder until PRD-009 lands).

### Visual reference

```
┌─ Site: besafe-ltd.myshopify.com ──────── Shopify · Active ──┐
│ Overview | Widget | Destinations | Shopify                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                              │
│ Proactive engagement                              [ON ●]    │
│  ├─ Fire on:        ☑ Product  ☐ Collection  ☐ Cart        │
│  ├─ After:          [20] seconds                            │
│  ├─ Frequency:      [Once per session ▾]                    │
│  └─ Greeting style: [Agent + canned fallback ▾]             │
│                                                              │
│ Callback handoff                                  [ON ●]    │
│  ├─ Send to:        [2 destinations →]                      │
│  ├─ Working hours:  Mon-Fri 9:00-17:00 (Europe/London)      │
│  ├─ SLA:            "Aim to call within 4 working hours"   │
│  └─ Capacity:       [Limited ▾] (softens phrasing)          │
│                                                              │
│ Cart-idle proactive                               [OFF ○]   │
│  ├─ Idle threshold: [90] seconds                            │
│  └─ Greeting:       [Any questions before you check out?]   │
│                                                              │
│ Last 7 days: 12 callbacks (10 delivered, 2 failed) · 47 ... │
└──────────────────────────────────────────────────────────────┘
```

---

## Backend contracts

### Sites API

```
GET    /api/sites                          → list workspace's sites
POST   /api/sites                          → create (during OAuth callback or "custom" picker)
GET    /api/sites/{site_id}                → full Site incl. capabilities
PATCH  /api/sites/{site_id}                → update display_name, status
PATCH  /api/sites/{site_id}/settings       → partial update of settings JSONB
GET    /api/sites/{site_id}/telemetry      → 7-day rollup for dashboard
DELETE /api/sites/{site_id}                → soft-delete (status='disconnected')
```

### Callback API

```
POST   /api/widgets/callback
  Headers:  Authorization: Bearer ak_pub_<site_pubkey>  (existing widget auth)
  Body:     { session_id, phone, name, product_context?, urgency?, preferred_time? }
  
  Returns 202 ACCEPTED:
  {
    accepted: true,
    eta_phrase: "We'll aim to call you within 4 working hours about the EN 12101-9 panel.",
    request_id: "cb_..."          // for idempotency / retry
  }
  
  Validation:
    - phone: E.164 regex
    - name: 1-100 chars
    - rate limits enforced
    - idempotency on {session_id, phone, 5-min-window}
  
  Side effect (async, queued):
    - For each destination in site.settings.callback.destinations:
        Redis task `callback_dispatch` runs → writes WidgetEventLog row on success/failure
```

### Telemetry write helper

Follows PRD-139 pattern — module-level write helper, safe to call from anywhere, fire-and-forget.

```python
# orchestrator/modules/widgets/telemetry.py
async def log_widget_event(
    site_id: UUID,
    event_type: str,
    session_id: str | None = None,
    event_data: dict | None = None,
) -> None:
    """Fire-and-forget. Failures don't propagate."""
    ...
```

---

## Async dispatch — how it works

Reuse the existing Redis-backed task queue from PRD-56/PRD-59 (`orchestrator/core/task_runner/queued.py`). Pattern:

```
1. Widget POSTs /callback
2. Orchestrator validates + writes WidgetEventLog(event_type='callback_requested')
3. For each destination:
     LPUSH queue:widget_callbacks {site_id, destination, payload, attempt: 1}
4. Orchestrator returns 202 with eta_phrase  (< 100ms total)
5. Worker pops task, dispatches to destination
   On success:  WidgetEventLog(event_type='callback_delivered', event_data={destination, latency_ms})
   On failure:  WidgetEventLog(event_type='callback_failed', event_data={destination, error, attempt})
              If attempt < 3: LPUSH back with attempt+1 and exponential backoff
              If attempt = 3: write permanent failure; dashboard shows destination as ERROR
6. Dashboard reads WidgetEventLog for "last delivery" timestamps + status pills
```

**Why this matters for 4.6M scale**: a single misconfigured CRM webhook in one merchant's account cannot block any other merchant's bot replies. Worker concurrency scales horizontally — same pattern already used for agent task execution.

---

## i18n (en-GB at launch, locale plumbing in place)

All user-facing strings (SLA phrases, default greetings, default canned fallbacks, dashboard labels) resolve through a locale resolver — never hardcoded.

**v1**: en-GB. **Plumbing-ready for**: en-US, fr-FR, de-DE, es-ES (translate when first non-English merchant requires).

```typescript
// frontend/lib/i18n/strings/widget.en-GB.json
{
  "callback.sla_template": "We'll aim to call you within {hours} working hours{product_clause}.",
  "callback.product_clause": " about the {product}",
  "callback.outside_hours": "Our team's offline now — they're back at {next_open}. We've logged your details and they'll call you then.",
  "cart_idle.default_greeting": "Any questions before you check out?",
  "proactive.default_canned": "Need a hand finding the right product?"
}
```

On the orchestrator side, locale is resolved per request from `site.settings.locale` (default `en-GB`).

---

## Cross-cutting requirements

| Requirement | How |
|---|---|
| **GDPR** | Phone forwarded to merchant destinations, NOT persisted in Automatos beyond conversation transcript. Transcripts encrypted at rest. Default 30-day retention, merchant-overridable per Site. |
| **Idempotency** | `POST /callback` dedupes on `{session_id, phone, 5-min-window}`. Returns same `request_id` for duplicates. |
| **Rate limiting** | Per-session (1 callback / 60s), per-IP (10 / hour), per-Site (configurable, default 100 / hour). 429 on breach with `Retry-After`. |
| **Delivery confirmation** | Every destination dispatch writes a `WidgetEventLog` row. Dashboard shows live status pill per destination. Failed destination → dashboard banner + email notification to workspace admins. |
| **Telemetry** | All proactive/cart-idle/callback lifecycle events written to `widget_event_log`. Dashboard rollup queries this; future analytics sinks (PostHog, etc.) consume it downstream. |
| **Async dispatch** | All destination delivery via Redis queue. `/callback` returns in <100ms regardless of destination latency. |
| **Validation** | Phone E.164 on backend. Webhook URLs validated for HTTPS + reachability on save (one-time probe). Email destinations verified via test-send button in dashboard. |
| **Audit trail** | All settings changes write `widget_event_log(event_type='settings_changed', event_data={path, old, new, user_id})`. |

---

## Implementation plan — 13 days

| Phase | Work | Days | Repo |
|---|---|---|---|
| 1 | Sites table + migration + model + tests | 2 | `automatos-ai` |
| 2 | Sites API endpoints + service layer | 2 | `automatos-ai` |
| 3 | Update existing PRD-007 call sites to resolve via Site | 0.5 | `automatos-ai` |
| 4 | `widget_event_log` table + telemetry helper + tests | 0.5 | `automatos-ai` |
| 5 | Callback endpoint + validation + idempotency + rate limits + tests | 1.5 | `automatos-ai` |
| 6 | Destination dispatchers (email, slack, crm webhook, shopify note) + Redis queue task + tests | 1.5 | `automatos-ai` |
| 7 | Cart-idle trigger in SDK + tests | 1 | `automatos-widget-sdk` |
| 8 | Phone-capture form in chat-widget + tests | 1 | `automatos-widget-sdk` |
| 9 | Sites hub dashboard (list, connect picker, overview, widget settings, destinations) | 2 | `automatos-ai` (frontend) |
| 10 | Shopify-specific tab (theme deeplink, scope status, sync placeholder) | 1 | `automatos-ai` (frontend) |
| 11 | i18n scaffolding + en-GB strings | 0.5 | `automatos-ai` (frontend + backend) |
| 12 | Documentation update: SETUP-GUIDE, EMBEDDING.md, RUNBOOKS | 0.5 | `automatos-shopify` + `automatos-widget-sdk` |

**Total: 13 days.** Phases 1–6 are sequential (backend foundation). Phases 7–8 can run in parallel with backend. Phases 9–10 require phases 1–6 done. Phase 11–12 cross-cuts the last week.

### Parallelization

With 2 engineers: ~7 working days (one on backend phases 1–6, one on SDK phases 7–8 + frontend phases 9–10 once API contracts are agreed at end of day 2).

---

## Success criteria

Universal — not skewed to INBUILD UK. Tested against three Sites: Shopify (besafe-ltd), custom-embed (mock), Shopify (INBUILD UK).

| Check | Pass condition | Measurement |
|---|---|---|
| Workspace can have multiple Sites | Create 3 Sites under one workspace; each has independent `widget_proactive` settings | Manual test |
| Existing workspaces migrate cleanly | Run migration on fresh DB seeded with current schema → all existing widgets keep firing | Test in staging with copy of prod data |
| Callback POSTs return in <100ms | `time curl -X POST /callback` → <100ms regardless of destination latency | Synthetic test, 100 iterations |
| Destinations fan out via queue | Configure 3 destinations; submit 1 callback; 3 delivery events appear in `widget_event_log` within 10s | E2E test |
| Destination failure isolated | Configure 2 destinations, one with broken webhook; the working one still delivers | E2E test |
| Dashboard surfaces destination health | Misconfigure a webhook → dashboard shows "FAILED" within 60s of next dispatch attempt | Manual test |
| Cart-idle fires only when `has_cart` | Custom-embed Site (no cart capability) hides the Cart-idle panel entirely | Visual check + DOM assertion |
| Working hours pre-fill from Shopify | Shopify Site → working hours editor opens with `Europe/London` (or shop's actual tz) pre-filled | Visual check |
| GDPR default retention | New Site defaults to 30-day transcript retention; phone never persists in widget table beyond transcript | Schema + retention job test |
| Rate limits enforced | 11th callback from same IP in an hour → 429 with `Retry-After` | Synthetic test |
| Idempotency works | Submit same `{session, phone}` 3× in 60s → 1 destination dispatch, 1 request_id returned all 3 times | Synthetic test |
| Telemetry rollup populates dashboard | Trigger 10 callbacks across 2 days → dashboard "Last 7 days" reads correctly | E2E test |
| No PRD-007 regression | Existing proactive popup on Shopify Sites still works exactly as today | Smoke test on besafe-ltd |
| Outside-hours phrasing differs | Submit callback at 23:00 UK time → eta_phrase mentions "first thing tomorrow" not "within 4 hours" | Time-shifted test |
| Capacity-aware phrasing | `team_capacity=limited` → phrase says "aim to call"; `team_capacity=normal` → "will call" | Config flip test |

---

## Risks

| Risk | Mitigation |
|---|---|
| Migration breaks existing Shopify customers' running widgets | Run migration idempotently; keep `workspace.settings.widget_proactive` readable for one release as fallback; smoke test against besafe-ltd before prod rollout |
| Agency multi-Site UX more complex than v1 anticipated | Out of scope: bulk Site import. Document the constraint; agencies onboard Sites one-at-a-time in v1; revisit in PRD-008-A.1 if signal comes in |
| Destination delivery failures silent | Mandatory: every dispatch writes a `widget_event_log` row; dashboard pills + email notification on persistent failures (3 attempts) |
| Phone retention runs afoul of EU privacy law | Default 30-day transcript retention; phone NEVER persists outside transcript; merchant can configure shorter retention; document data flow in PRIVACY.md |
| Channel capability drift (we add a capability, old Sites don't have it) | Capabilities are derived deterministically from Site type + Shopify scopes; recomputed on every PATCH; backfill job available |
| Redis queue backpressure during traffic spikes | Existing queue infra has monitoring; add alert when `queue:widget_callbacks` depth >1000 |
| Concurrent settings edits race-condition | All PATCH `/sites/{id}/settings` use optimistic locking via `updated_at` timestamp |
| Widget SDK + backend version skew | Cart-idle trigger validates against allowed types on backend; unknown trigger types return 400 with helpful message |
| Workspace-without-Shopify-domain edge case in migration | Migration creates a `type='custom'` Site with `external_id=null`; merchant can rename later |
| INBUILD UK (PoC client) blocked on agency multi-Site they haven't asked for | Confirm: they want one Shopify Site, one Automatos workspace. v1 supports that perfectly. |

---

## What this PRD does NOT decide

- **PRD-008-B (Cart Commerce Intelligence)** — cross-sell + bulk pricing. Both require PRD-009 Layer 2. Documented as a follow-up; not built here.
- **Native CRM connectors** (HubSpot, Salesforce, Pipedrive). Generic webhook only in v1.
- **SMS notifications** to merchant team. Email/Slack/webhook/customer-note only in v1.
- **A/B testing of callback phrases or cart-idle greetings**. Single variant per Site.
- **Shopper history personalization** (RFM, lifetime value). Anonymous sessions only.
- **Automatos-side inbox** for callbacks. Destinations only — merchant manages in their channel of choice.
- **Multi-agent-per-Site** routing. One agent per workspace shared across Sites in v1.
- **Bulk Site import** for agencies. One-at-a-time in v1.
- **The PRD-009 grounding work**. Parked until 008-A ships.

---

## Acceptance plan

Validation across three test Sites under one workspace — proves the multi-Site model works.

1. **besafe-ltd.myshopify.com** (Shopify) — full feature exercise: callback + cart-idle + Shopify-specific tab.
2. **INBUILD UK** (Shopify) — production validation: turn on B + C1 with their nominated destinations.
3. **mock-custom-site** (Custom embed) — capability-gated UI test: Cart-idle panel hidden, Proactive + Callback panels visible.

Per-scenario:
- Connect Site via dashboard (Shopify OAuth or "custom embed" picker).
- Verify capabilities populated correctly.
- Configure callback with 2 destinations (email + Slack webhook).
- Submit a test callback from a real browser; verify 202 returns in <100ms; verify both destinations receive payload within 30s; verify `widget_event_log` has 3 rows (requested, delivered×2).
- Misconfigure a third destination (broken webhook); submit another callback; verify the working destinations still deliver and the broken one shows FAILED in dashboard.
- For Shopify Sites: enable cart-idle; navigate to `/cart` in storefront; idle for 90s; verify popup fires with configured greeting.
- For custom Site: verify Cart-idle panel is hidden in dashboard.
- After working hours: submit callback; verify eta_phrase uses outside-hours template.

---

## Cross-references

- Foundation: `docs/PRDS/PRD-007-PROACTIVE-WIDGET-ENGAGEMENT.md`
- Deferred follow-up: `docs/PRDS/PRD-008-CALLBACK-AND-CART-FEATURES.md` (now scoped to "PRD-008-B" — cross-sell + bulk pricing, gated on PRD-009 Layer 2)
- Parked: `docs/PRDS/PRD-009-PRODUCT-KNOWLEDGE-GROUNDING.md` (Layer 1 shipped to orchestrator on `feat/prd-009-layer-1-grounded-context`; Layers 2–3 resume after PRD-008-A)
- Source discovery: `docs/SHOPIFY/CLIENT-DISCOVERY-INBUILDUK.md` §2a (Features B + C1; C2 + C3 deferred)
- Existing infrastructure reused:
  - `orchestrator/core/task_runner/queued.py` (Redis queue from PRD-56/PRD-59)
  - `orchestrator/modules/tools/execution/telemetry.py` (PRD-139 telemetry pattern)
  - `orchestrator/core/models/channels.py` (`ChannelConnection` — adjacent concept, kept distinct)
- Skills to update:
  - `automatos-skills/shopify/shopify-support/SKILL.md` — handle `callback_intent` events; route to callback capture flow.
- Sibling repos touched: `automatos-ai` (orchestrator, frontend, migrations), `automatos-widget-sdk` (cart-idle trigger, callback form UI).
