# Automatos ↔ Shopify — Architecture & Flows

**Purpose:** single reference for how the pieces connect and what happens in each scenario. Every step is labelled so PRDs, tickets, and debugging conversations can cite `W3` or `I7` instead of re-describing the flow.

**Last updated:** 2026-04-17

---

## 1. System map (static view)

Everything that exists, and the links between them. No direction of flow — just "A knows about B".

```mermaid
graph LR
  subgraph Merchant["Merchant's Shopify store"]
    SF[Storefront<br/>public web]
    ADM[Shopify Admin<br/>merchant-authenticated]
    TH[Theme extension<br/>app blocks]
  end

  subgraph Shopify["Shopify platform"]
    SP[Partner API<br/>OAuth + app mgmt]
    SA[Admin GraphQL API<br/>product/order/etc]
    SW[Webhooks<br/>orders/shop/uninstall]
  end

  subgraph Automatos["Automatos platform"]
    APP[Partner App<br/>automatos-shopify on fly.dev]
    CDN[sdk.automatos.app<br/>S3 + CloudFront]
    ORCH[Orchestrator<br/>API + agents + RAG]
    DB[(Postgres<br/>workspaces, api_keys,<br/>agents, conversations)]
    REDIS[(Redis<br/>rate limits, JWT cache)]
    DASH[Automatos Dashboard<br/>ui.automatos.app]
  end

  subgraph External["Third parties"]
    COMP[Composio<br/>auth broker + tool executor]
    LLM[LLM providers<br/>Anthropic / OpenAI]
    VEC[(Vector store<br/>RAG corpus)]
  end

  SF  --- TH
  ADM --- APP
  TH  --- CDN
  TH  --- ORCH
  APP --- SP
  APP --- SA
  APP --- ORCH
  APP --- SW
  ORCH --- DB
  ORCH --- REDIS
  ORCH --- COMP
  ORCH --- LLM
  ORCH --- VEC
  DASH --- ORCH
  DASH --- COMP
  COMP --- SA
```

### Component glossary

| Label | Name | What it owns | PRD |
|---|---|---|---|
| `SF` | Storefront | Shopper-facing public web pages | — |
| `ADM` | Shopify Admin | Merchant's admin console; host of the embedded app | — |
| `TH` | Theme extension | `extensions/automatos-theme/blocks/*.liquid` — app blocks the merchant drops into their theme | 003, 005 |
| `SP` | Partner API | Shopify's OAuth + app management API | — |
| `SA` | Admin GraphQL API | The real Shopify data plane (products, orders, customers) | — |
| `SW` | Webhooks | Shopify → Automatos push (orders/create, shop/update, app/uninstalled, compliance) | 001 |
| `APP` | Partner App | `automatos-shopify` React-Router embedded app on fly.dev | 001, 004 |
| `CDN` | Widget CDN | `sdk.automatos.app` — S3 + CloudFront, serves `widget.js` | 003 |
| `ORCH` | Orchestrator | Automatos backend — API endpoints, agent runtime, tool routing | 004, 006 |
| `DB` | Postgres | Workspaces, api_keys, agents, conversations, audit log | 006 |
| `REDIS` | Redis | Rate-limit token buckets, JWT revocation, session cache | 006 |
| `DASH` | Dashboard | `ui.automatos.app` — standalone Automatos frontend | — |
| `COMP` | Composio | External SaaS — holds per-merchant Shopify OAuth tokens, executes ~394 Shopify tools | 004 |
| `LLM` | LLM providers | Anthropic / OpenAI — agent reasoning | — |
| `VEC` | Vector store | RAG corpus (product catalogue, docs, past conversations) | — |

---

## 2. Flow I — App Store install (merchant onboards)

**Trigger:** merchant clicks "Add app" on the Shopify App Store listing.
**Goal:** after this flow, the merchant has a workspace, 9 seeded agents, a stored Shopify access token, and a Composio connected_account — all without leaving Shopify admin.

**Current status:** steps `I1–I7` are live. Step `I8` is the gap PRD-004 closes.

```mermaid
sequenceDiagram
  autonumber
  participant M as Merchant
  participant SP as Shopify Partner OAuth
  participant APP as automatos-shopify (APP)
  participant ORCH as Orchestrator
  participant DB as Postgres
  participant COMP as Composio

  M->>SP: I1. Click "Add app" on App Store
  SP->>M: I2. Show scope approval screen
  M->>SP: I3. Approve install
  SP->>APP: I4. OAuth callback w/ access_token + shop
  APP->>APP: I5. auth.callback.tsx — fetch shop metadata via GraphQL
  APP->>ORCH: I6. POST /workspace — provisionWorkspace(shop, meta)
  ORCH->>DB: I6a. UPSERT workspace (idempotent on shop domain)
  APP->>ORCH: I7. POST /agents/seed — seedAgents(workspace.id)
  ORCH->>DB: I7a. INSERT 9 seeded agents
  APP->>ORCH: I8. POST /api/integrations/shopify/connect — storeShopifyCredentials
  ORCH->>DB: I8a. Store access_token for direct Admin API fallback
  ORCH->>COMP: I8b. Import token → connected_account  [PRD-004 gap]
  COMP-->>ORCH: I8c. connected_account_id
  ORCH->>DB: I8d. Save connected_account_id on workspace
  ORCH-->>APP: I9. 200 OK w/ ids
  APP->>M: I10. Redirect to /app — widgets + agents ready
```

**Labels for conversation:**
- `I4` — where Shopify hands us the merchant's access token
- `I6` — workspace provisioning (open question: auto-provision vs link-existing — blocks PRD-004)
- `I8b` — the ONE missing piece for single-flow install (tonight's spike found `.create()` doesn't exist; tomorrow probes `.link()` / `.update()`)

---

## 3. Flow W — Storefront widget conversation (shopper asks something)

**Trigger:** shopper on the merchant's storefront interacts with an Automatos widget (chat, product-qa, blog, etc.).
**Goal:** widget shows a response that may involve real-time Shopify data (stock, price, order status) routed via Composio.

```mermaid
sequenceDiagram
  autonumber
  participant SH as Shopper browser
  participant CDN as sdk.automatos.app
  participant ORCH as Orchestrator
  participant REDIS as Redis
  participant COMP as Composio
  participant SA as Shopify Admin API
  participant AGT as Agent runtime
  participant LLM as LLM provider
  participant VEC as Vector store

  SH->>CDN: W1. GET /v1/widget.js (script tag)
  CDN-->>SH: W2. widget.js (cached 1hr)
  SH->>SH: W3. AutomatosWidget.init() mounts Shadow DOM
  SH->>ORCH: W4. POST /api/widgets/session {ak_pub_*, origin}
  ORCH->>ORCH: W5. Validate origin, hash key
  ORCH->>REDIS: W6. Token-bucket rate check
  ORCH-->>SH: W7. Short-lived JWT (5 min) + workspace context
  SH->>ORCH: W8. WS/SSE connect w/ JWT, send user message
  ORCH->>AGT: W9. Route to allowlisted agent
  AGT->>VEC: W10. RAG lookup (products, support docs)
  AGT->>LLM: W11. Reason + decide tool calls
  AGT->>COMP: W12. Execute SHOPIFY_GET_PRODUCT (via Composio)
  COMP->>SA: W12a. Real Admin API call using stored OAuth token
  SA-->>COMP: W12b. Product JSON
  COMP-->>AGT: W12c. Tool result
  AGT->>LLM: W13. Compose reply using tool result
  LLM-->>AGT: W14. Final text
  AGT-->>ORCH: W15. Stream tokens
  ORCH-->>SH: W16. Stream response over WS/SSE
  SH->>SH: W17. Render in Shadow DOM
```

**Labels for conversation:**
- `W1–W2` — the CDN hop (PRD-003). Failure here = widget never loads.
- `W4–W7` — the auth handshake (PRD-006). `ak_pub_*` never crosses the wire after `W4`; JWT does.
- `W9` — agent allowlist enforcement (public key can only invoke scoped agents).
- `W12` — Composio hop. If PRD-004 hasn't wired the connected_account, this 403s.
- `W12a` — this is why the merchant must complete the Composio connect step (or why PRD-004 matters).

**Two-way traffic note:** `W8`, `W15`, `W16` are the persistent WS/SSE channel. Everything after the initial handshake is streamed — widget and orchestrator stay connected for the conversation duration.

---

## 4. Flow E — Embedded admin agent action (merchant asks for something)

**Trigger:** merchant inside Automatos embedded app in Shopify Admin clicks "Daily brief", "Run audit", etc.
**Goal:** agent executes write-scope Shopify operations using the server-side token, not the widget public key.

```mermaid
sequenceDiagram
  autonumber
  participant M as Merchant (in Shopify Admin)
  participant APP as automatos-shopify embedded
  participant ORCH as Orchestrator
  participant AGT as Agent runtime
  participant COMP as Composio
  participant SA as Shopify Admin API

  M->>APP: E1. Click "Run daily brief" in embedded app
  APP->>ORCH: E2. POST /agents/run (session authenticated via App Bridge)
  ORCH->>AGT: E3. Instantiate agent w/ server-tier scope
  AGT->>COMP: E4. Execute SHOPIFY_* tools (read + write allowed)
  COMP->>SA: E4a. Admin API call w/ merchant's stored token
  SA-->>COMP: E4b. Response
  COMP-->>AGT: E4c. Tool result
  AGT->>AGT: E5. Reason, possibly call more tools
  AGT-->>ORCH: E6. Structured result (summary, recommendations, actions)
  ORCH-->>APP: E7. Stream result
  APP->>M: E8. Render via Polaris (native Shopify UI)
```

**Labels for conversation:**
- `E2` — authentication uses the Shopify App Bridge session token, not `ak_pub_*`. Different tier → can invoke write-scope tools.
- `E4` — same Composio hop as `W12`, but the agent runtime is operating under the server-key scope, so `write_products`, `draft_orders/create` etc are permitted.
- `E8` — admin widgets use native Polaris (per PRD-005 Option A). No Shadow DOM like storefront.

---

## 5. Flow R — Agent reasoning (internal)

**Trigger:** called from `W9` or `E3`. Not visible outside the orchestrator.
**Goal:** turn a user message into a response, using any combination of tools, RAG, and sub-agents.

```mermaid
graph TD
  R1[R1. Receive user message<br/>+ context + tier] --> R2[R2. Classify intent]
  R2 --> R3{R3. Needs tools?}
  R3 -->|Yes| R4[R4. Select allowlisted tools<br/>per tier + agent]
  R3 -->|No| R7
  R4 --> R5[R5. LLM: reason + choose tool calls]
  R5 --> R6[R6. Execute via Composio<br/>or direct API]
  R6 --> R5
  R5 --> R7[R7. RAG: retrieve context<br/>product catalogue, docs, past convos]
  R7 --> R8[R8. LLM: compose reply w/ tool+RAG context]
  R8 --> R9{R9. Needs another agent?}
  R9 -->|Yes| R10[R10. Delegate to sub-agent<br/>back to R1]
  R9 -->|No| R11[R11. Stream response to caller]
  R10 --> R11
```

**Labels for conversation:**
- `R4` — where PRD-006's tool allowlist kicks in. Public-key agents get read-only; server-key agents get read+write.
- `R7` — RAG corpus per-workspace. Product catalogue synced from Shopify, support docs uploaded in dashboard.
- `R10` — agent-to-agent delegation. E.g. `shopify-support` asks `shopify-product-expert` for stock detail.

---

## 6. Boundaries & trust summary

Quick mental model of what crosses which trust boundary — useful for security reviews.

| Boundary | What crosses | Who controls it | Auth mechanism |
|---|---|---|---|
| Shopper browser → CDN | Public JS | Automatos | None (public asset) |
| Shopper browser → Orchestrator | User message + JWT | Shopper (can see JWT) | Short-lived origin-bound JWT |
| Widget JS → Orchestrator (init only) | `ak_pub_*` | Merchant (baked in Liquid) | Origin allowlist + rate limit (PRD-006) |
| Orchestrator → Composio | Agent requests | Automatos | Composio API key (server-only) |
| Composio → Shopify Admin API | Tool executions | Composio | Per-merchant stored OAuth token |
| Merchant Admin → Embedded app | App Bridge session | Merchant | Shopify session token (short-lived, signed) |
| Webhook source → Orchestrator | Shopify → Automatos pushes | Shopify | HMAC signature verify |

**The public API key (`ak_pub_*`) is the only credential that appears client-side.** Everything else — Shopify access token, Composio API key, LLM keys, RAG credentials — lives server-side only. This is the whole reason PRD-006 exists.

---

## 7. "Two-way" clarifications

User asked: *is the storefront widget → orchestrator flow two-way?*

**Yes, twice:**

1. **Session init (request/response):** `W4` → `W7` is a simple POST/response over HTTPS. One-shot.
2. **Conversation stream (persistent):** `W8` opens a WebSocket or SSE channel that stays alive for the duration of the chat. `W15`/`W16` stream tokens back as the LLM produces them. The shopper can send follow-up messages over the same channel without re-initiating.

**Storefront widget → Shopify:** indirect — the widget NEVER talks to Shopify directly. All Shopify data flows through `ORCH → COMP → SA`. That's deliberate: the widget has no Shopify token, only a short-lived Automatos JWT.

---

## 8. How to reference this doc

In PRDs, tickets, or conversations:
- "Breaks at `W12`" — means the Composio tool-execution hop failed
- "Need to add `I8b` before shipping" — the Composio token import
- "Public key model guards `W4–W7`" — PRD-006's scope
- "PRD-003 stands up the `CDN` node and the `W1–W2` path"
- "Admin flow uses `E2` auth not `W4` auth" — different tier, different capabilities

Keep this doc in lockstep with the PRDs. When a flow changes, bump the section and note the date. Stale diagrams are worse than no diagrams.
