# PRD: Widget Auth Model

**PRD ID:** SHOPIFY-006
**Status:** Draft
**Owner:** Gerard
**Date:** 2026-04-16
**Priority:** P0 — Must land before the CDN does, or public API keys get scraped and abused

---

## Problem

Widgets run in the merchant's storefront: public web, unauthenticated shoppers, CSP-restricted. The only credential the widget carries is an `ak_pub_*` public API key, baked into the Liquid template and therefore **visible to any visitor's view-source**.

Without further controls, this public key is a free pass to:
- Rack up usage against the merchant's quota (cost abuse)
- Exhaust rate limits (denial of service to the merchant)
- Invoke agents on behalf of the merchant's workspace in ways the merchant never intended
- Escalate via an agent that has write-scope Shopify tools attached (e.g., `write_products`)

The SDK README confirms the dual-key model (`ak_pub_*` vs `ak_srv_*`) but doesn't specify the server-side enforcement that makes public keys safe. This PRD specifies it.

---

## Goal

Make `ak_pub_*` keys safe to expose in storefront HTML: scoped, rate-limited, bound to an origin, and incapable of invoking destructive tools.

---

## Success Criteria

| Check | Pass condition |
|---|---|
| Public key scraped from view-source cannot be used from a different origin | CORS + origin allowlist enforced |
| Public key usage bounded per shop per day | Rate limit + quota enforced server-side |
| Public key cannot invoke agents outside an explicit widget allowlist | Agent-binding enforcement |
| Public key cannot invoke write-scope Shopify tools (e.g., `write_products`) via agent | Tool allowlist at public-key tier |
| Abuse triggers alert, not silent failure | Alerting wired |
| Public key rotation without widget re-deploy | Yes (key → workspace mapping stored server-side, not embedded) |

---

## Scope

### In scope
- Public-key auth model: scope, binding, rate limits, tool allowlist
- Origin binding: public keys are bound to one or more allowed origins (shop domain + primary domain)
- WebSocket/SSE auth: short-lived JWT minted server-side per widget session, widget uses JWT after initial handshake
- Abuse detection: metrics + alert thresholds
- Documentation: publish auth model in SDK README + widget-sdk package docs

### Out of scope
- Server-key (`ak_srv_*`) model — already safe (never exposed client-side)
- Shopper-level identity (customer login on storefront) — separate concern, widget is agent-facing not customer-auth-facing
- Encryption of agent conversation content (handled at TLS layer; content privacy is a future PRD)

---

## Model

### Public key structure

```
ak_pub_<workspace_public_id>_<random-suffix>
```

- Maps 1:1 to a workspace
- Carries a scope set on issuance (which widgets it can initialise, which agents it can invoke, which tool classes those agents can call)
- Revocable; rotating issues a new key, old key deactivated after grace window

### Origin binding

Each public key has an `allowed_origins` array (e.g., `["https://1lovefragrance.myshopify.com", "https://1lovefragrance.com"]`). CORS preflight rejects other origins. Server confirms `Origin` header matches allowed list on every authenticated call.

For App Store install, origins auto-populate from Shopify metadata on install (shop domain + primary_domain). Merchant can edit in embedded app settings.

### Rate limits & quotas

| Tier | Requests/min | Messages/day | Token budget/day |
|---|---|---|---|
| Trial | 20 | 200 | 50k |
| Starter | 60 | 1,000 | 250k |
| Growth | 200 | 10,000 | 2M |
| Enterprise | Custom | Custom | Custom |

Enforced at the orchestrator public-key auth middleware. Over-quota returns 429 with retry-after header; widget displays a "chat is temporarily unavailable" state.

### Agent allowlist

A public key is issued with an explicit list of agent slugs it can invoke. The Shopify-installed key gets the 9 seeded agent slugs (per `automatos.server.ts`). Trying to call any other agent returns 403.

### Tool allowlist per agent per public-key tier

Storefront widgets using public keys should not invoke write-scope tools. The orchestrator filters the agent's available tool set when invoked via a public key:

- Read tools: allowed
- Write tools: blocked unless explicitly unlocked per widget (e.g., "conversational shopper" may need `draft_orders/create` — opt-in, with merchant confirmation)

### JWT handshake

1. Widget loads `widget.js` → calls `POST /api/widgets/session` with `ak_pub_*` + origin
2. Server returns short-lived JWT (5 minutes) + workspace context
3. Widget uses JWT for subsequent WebSocket / SSE connections
4. JWT renewed automatically by SDK before expiry

This means the raw public key is only seen on the session-init request, not on every tool call. Reduces blast radius if a WebSocket connection is hijacked mid-session.

---

## Implementation plan

### 1. Orchestrator

- New middleware: `public_key_auth` — validates key, enforces origin, checks rate limit, issues JWT
- Key store schema: `api_keys` table with `workspace_id`, `key_type`, `allowed_origins`, `allowed_agents`, `tool_scope`, `tier`, `issued_at`, `revoked_at`
- Rate limit backend: Redis (assumed already in stack — verify)
- Metrics: per-key request count, token usage, error rate

### 2. SDK (`automatos-widget-sdk/packages/core`)

- `AuthManager.authenticate()` already exists (300-line `client.ts`) — extend to hit `/api/widgets/session` for public keys, cache JWT, refresh before expiry
- Handle 429 gracefully in conversation flow (don't throw; render "temporarily unavailable")
- Expose quota state to widget UI so merchants can optionally show usage

### 3. Embedded app

- New Polaris page: `/app/settings/api-keys` — view current public key, rotate, edit allowed origins
- On install, auto-issue public key with origins pre-populated from shop data and agent allowlist = seeded agents

### 4. Documentation

- Add "Public Key Security Model" section to widget-sdk README
- Add "Public Key" subsection to `COMPOSIO-SHOPIFY-SETUP.md` troubleshooting (when calls get 403, check origin)

---

## Risks

| Risk | Mitigation |
|---|---|
| CSP on merchant theme blocks `POST /api/widgets/session` | Use `sdk.automatos.app` subdomain (same origin as widget.js) for session endpoint to minimize new CSP entries; doc the needed `connect-src` value |
| Origin spoofing | Browser enforces `Origin` header for fetch/WS; additional server-side shop-domain check via widget-provided shop context (verifiable against Shopify-signed data if present) |
| JWT leak within session | Short TTL (5 min), origin-bound, revocable |
| Quota-exhaustion DoS by a competitor scraping the key | Per-IP rate limiting on top of per-key; CAPTCHA fallback at high tier |
| Legitimate high-traffic merchant hits quota, widget silently dies | Alert merchant via embedded app + email before hard-blocking |

---

## Design appendix (locked 2026-04-16)

### A. SQL migration skeleton (draft — not applied)

```sql
-- migration: add_public_api_keys.sql
-- target DB: orchestrator Postgres
-- NOT YET APPLIED. Review + run in a branch before touching prod.

CREATE TABLE IF NOT EXISTS api_keys (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    key_prefix            VARCHAR(32) NOT NULL,        -- "ak_pub_<workspace_public_id>_"
    key_hash              VARCHAR(128) NOT NULL,       -- sha256 of the full key; never store plaintext
    key_type              VARCHAR(16) NOT NULL CHECK (key_type IN ('public', 'server')),
    tier                  VARCHAR(16) NOT NULL DEFAULT 'trial'
                                                       CHECK (tier IN ('trial','starter','growth','enterprise')),
    allowed_origins       JSONB NOT NULL DEFAULT '[]'::JSONB, -- array of origin strings
    allowed_agents        JSONB NOT NULL DEFAULT '[]'::JSONB, -- array of agent slugs
    tool_scope            VARCHAR(16) NOT NULL DEFAULT 'read_only'
                                                       CHECK (tool_scope IN ('read_only','read_write','custom')),
    custom_tool_allowlist JSONB,                       -- used only when tool_scope='custom'
    issued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at          TIMESTAMPTZ,
    revoked_at            TIMESTAMPTZ,
    revoked_reason        TEXT,
    rotation_grace_until  TIMESTAMPTZ,                 -- old key stays valid until this after rotation
    metadata              JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE INDEX idx_api_keys_workspace_active ON api_keys(workspace_id)
    WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);

-- Rate limit state lives in Redis, not Postgres (hot path). Fallback schema if Redis unavailable:
CREATE TABLE IF NOT EXISTS api_key_usage_buckets (
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    bucket     VARCHAR(32) NOT NULL,                    -- 'minute', 'day'
    window_start TIMESTAMPTZ NOT NULL,
    request_count BIGINT NOT NULL DEFAULT 0,
    token_count   BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (api_key_id, bucket, window_start)
);
```

Verification before applying:
- Confirm `workspaces(id)` is `UUID`. If not, align the FK type.
- Confirm `gen_random_uuid()` (pgcrypto) is enabled; if not, use `uuid_generate_v4()` from uuid-ossp.

### B. Middleware pseudocode

```python
# orchestrator/api/middleware/public_key_auth.py  (pseudocode)

async def public_key_auth(request, call_next):
    raw_key = request.headers.get("x-automatos-api-key")
    if not raw_key or not raw_key.startswith("ak_pub_"):
        return forbidden("missing or malformed public key")

    key_hash = sha256(raw_key)
    api_key = await db.fetch_one(
        "SELECT * FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL",
        key_hash,
    )
    if not api_key:
        return forbidden("invalid public key")

    # 1. Origin enforcement
    origin = request.headers.get("origin")
    if origin not in api_key.allowed_origins:
        # Only log the host, never the full origin header (avoid PII in logs for embedded domains)
        log.warn("origin_rejected", key_id=api_key.id, host=urlparse(origin).hostname)
        return forbidden("origin not allowed")

    # 2. Rate limit (Redis token bucket)
    tier_config = TIER_LIMITS[api_key.tier]
    allowed = await rate_limiter.consume(
        key=f"rate:pub:{api_key.id}:minute",
        capacity=tier_config.rpm,
        refill_per_second=tier_config.rpm / 60,
    )
    if not allowed:
        return too_many_requests(retry_after=rate_limiter.retry_after(api_key.id))

    # 3. Mint short-lived JWT
    jwt = sign_jwt({
        "sub": api_key.id,
        "wsp": api_key.workspace_id,
        "tier": api_key.tier,
        "allowed_agents": api_key.allowed_agents,
        "tool_scope": api_key.tool_scope,
        "origin": origin,
        "iat": now(),
        "exp": now() + 300,   # 5 minutes
    })

    await db.execute(
        "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1",
        api_key.id,
    )

    request.state.api_key = api_key
    request.state.jwt = jwt
    return await call_next(request)
```

### C. Tier thresholds (locked for PRD-006 v1)

| Tier       | RPM | Messages/day | Token budget/day |
|------------|-----|--------------|------------------|
| trial      | 20  | 200          | 50,000           |
| starter    | 60  | 1,000        | 250,000          |
| growth     | 200 | 10,000       | 2,000,000        |
| enterprise | configurable per contract (default: `growth` × 5) |

Rationale:
- trial caps at ~7 concurrent conversations (20 RPM with typical 3-message exchange) — demo-able, not production.
- starter supports a single storefront with ~50 DAU.
- growth handles a medium-traffic storefront (~5k DAU).
- enterprise is hand-tuned, with minimums no lower than growth tier.

### D. JWT claim structure (locked)

| Claim | Type | Purpose |
|---|---|---|
| `sub` | UUID string | `api_keys.id` — session auditability |
| `wsp` | UUID string | Workspace scope; tool calls authorise against this |
| `tier` | enum | For downstream per-call enforcement |
| `allowed_agents` | string[] | Agent slug allowlist; orchestrator refuses other slugs |
| `tool_scope` | enum | `read_only` / `read_write` / `custom` |
| `origin` | string | Bound origin — WebSocket sub-protocol validates on reconnect |
| `iat` | unix ts | |
| `exp` | unix ts | `iat + 300` (5 min) |

Signed with HS256 using an orchestrator-held secret (rotate quarterly). Not encrypted — claims are not secret, origin binding makes theft useless.

### E. CORS enforcement points

1. **Preflight:** orchestrator serves `Access-Control-Allow-Origin: <echoed-if-in-allowlist>` for `POST /api/widgets/session`. Never `*` on authenticated endpoints.
2. **Session-init response:** includes `Access-Control-Allow-Origin` echoing the validated origin (not wildcard).
3. **WebSocket upgrade:** check `Origin` header during handshake; reject with 403 if not in allowlist.
4. **Tool-execute endpoint:** JWT `origin` claim must match the request's `Origin` header.

Defence-in-depth: an attacker with a stolen JWT from a scraped origin still cannot use it from a different host because both (a) CORS blocks the fetch at the browser layer and (b) server-side origin match rejects it if someone bypasses the browser.

---

## Open questions

- Is there already a `public_api_keys` table in the orchestrator? If yes, this PRD amends; if no, this is net-new schema.
- What's the Redis situation for rate-limiting? If none, token-bucket in Postgres with advisory locks is acceptable MVP.
- Should the JWT carry the `shop` claim so downstream tool calls can skip the shop-resolution step? Yes, but keep it non-authoritative — server re-verifies against workspace mapping.
- How does this interact with WebSocket persistence? If a JWT expires mid-stream, do we reconnect or graceful-degrade? Default: graceful close + reconnect with new JWT.
