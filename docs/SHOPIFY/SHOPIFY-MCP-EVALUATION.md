# Shopify MCP Server Evaluation

> Existing open-source MCP servers that provide real CRUD on Shopify stores.
> Phase 2 plan: containerize one of these instead of building from scratch.

**Date:** 2026-04-12
**Status:** Evaluated — decision deferred to Phase 2

---

## The landscape

The official Shopify Dev MCP (`@shopify/dev-mcp`) does NOT do CRUD. It's docs + schema validation only. The community has filled the gap.

---

## Top candidates

### 1. callobuzz/cob-shopify-mcp — RECOMMENDED

| Field | Value |
|---|---|
| **Stars** | 11 (new, March 2026) |
| **Language** | TypeScript |
| **License** | MIT |
| **Tools** | 64 across 5 domains |
| **Tests** | 600 |
| **npm** | `cob-shopify-mcp` |

**Why this one:**
- **64 tools:** Products (15), Orders (17), Customers (9), Inventory (7), Analytics/ShopifyQL (16)
- **Advertise-and-Activate:** Loads 1 meta-tool (~300 tokens) instead of 64 schemas (~19K tokens). Activates domains on demand. 82% context window savings — critical for multi-agent systems.
- **YAML-extensible:** Add custom tools via YAML config without forking
- **Dual transport:** stdio + Streamable HTTP (Docker-ready for multi-agent)
- **Dual mode:** MCP server AND standalone CLI
- **3 auth methods:** Static token, OAuth client credentials, OAuth authorization code
- **Cost tracking:** Every response includes Shopify API cost metadata
- **Rate limiting & caching:** Built-in, configurable TTL per query type
- **GraphQL-native:** Uses Shopify Admin GraphQL API (future-proof)

**Containerization plan:**
```dockerfile
FROM node:20-alpine
RUN npm install -g cob-shopify-mcp
EXPOSE 3000
CMD ["cob-shopify-mcp", "--transport", "http", "--port", "3000"]
```

**Multi-store routing:** Run one container per store, route by workspace_id → container. Or extend with a proxy layer that injects store credentials per request.

---

### 2. GeLi2001/shopify-mcp — ALTERNATIVE

| Field | Value |
|---|---|
| **Stars** | 190 (largest community) |
| **Language** | TypeScript |
| **License** | MIT |
| **Tools** | 31 |
| **npm** | `shopify-mcp` |

**Pros:** Proven, large community, simple architecture, good docs.
**Cons:** No analytics, no CLI mode, no context optimization, no YAML extensibility. Fork required for customization.

---

### 3. Others evaluated

| Repo | Stars | Tools | Verdict |
|---|---|---|---|
| benwmerritt/shopify-mcp | 4 | ~30 | Good OAuth, draft order support, but small |
| antoineschaller/shopify-mcp-server | 14 | 22 | JavaScript (not TS), no OAuth |
| amir-bengherbi/shopify-mcp-server | 16 | ~20 | Read-heavy, limited writes |
| siddhantbajaj/shopify-mcp-server | 6 | 2 | Python, too minimal |

---

## Decision

**Phase 1:** Composio (394 REST actions, zero build time, auth managed)
**Phase 2:** Containerize `callobuzz/cob-shopify-mcp` (GraphQL-native, 64 tools, YAML-extensible)

Trigger for Phase 2: either Composio REST deprecation issues surface, or we need the context optimization (Advertise-and-Activate) for multi-agent efficiency, or we want to ship a standalone "Shopify MCP by Automatos" for brand awareness.

---

## Automatos-specific extensions (Phase 3)

Custom tools to add via YAML or fork:

| Tool | Purpose |
|---|---|
| `get_agent_recommendations` | Query Automatos agent for product recommendations |
| `execute_mission_step` | Run a mission step against store data |
| `sync_memory` | Push store events into Automatos agent memory |
| `trigger_widget_update` | Force-refresh widget data (e.g., after inventory change) |
| `generate_brief` | Compile daily business brief from store analytics |

These turn the generic Shopify MCP into an Automatos-aware commerce MCP — the bridge between store data and agent intelligence.
