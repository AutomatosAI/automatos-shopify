# Shopify AI Toolkit Integration

**Status:** Research / technical integration plan
**Owner:** Gerard
**Date:** 2026-04-12
**Context:** Shopify launched AI Toolkit on 2026-04-09 — an open-source collection of ~16 skill files and a `shopify-admin-execution` layer for AI agents to act on Shopify stores.

---

## What the Toolkit is (and isn't)

**Is:**
- An open-source set of skill files that describe how an AI agent should interact with Shopify concepts (products, orders, customers, inventory, discounts, etc.)
- A `shopify-admin-execution` layer that takes validated actions against the Shopify Admin API
- Auto-updating plugins — Shopify ships updates when the underlying API changes
- Model-agnostic — works with any LLM that can read skill files and generate tool calls

**Isn't:**
- An end-to-end AI product (no agents, no memory, no orchestration, no UI)
- Multi-tenant or hosted — you run it yourself
- A complete merchant operating system — just the Shopify-specific execution layer

**The gap Shopify left open:** The Toolkit is the skills layer. It expects someone else to bring agents, orchestration, memory, multi-agent coordination, widgets, onboarding, and UI. That someone is Automatos.

---

## Why this lands perfectly for Automatos

Automatos is architected around this exact shape:

| Layer | Automatos provides | Shopify Toolkit provides |
|---|---|---|
| Skill definitions | Skills engine (PRD-71, git-sourced, marketplace) | 16 Shopify-specific skills |
| Skill execution | Unified tool router + action registry | `shopify-admin-execution` layer |
| Agents | AgentFactory, per-workspace agents | — |
| Orchestration | Sequential coordinator (PRD-82A) + parallel dispatcher (PRD-82C) | — |
| Memory | Mem0 + field memory + daily logs | — |
| Verification | Verification loop (PRD-103) + consistency checks | — |
| Multi-tenancy | Workspace isolation | — |
| Onboarding | Mission Zero wizard | — |
| UI | Widget SDK + platform admin | — |

**We own every layer except the skill definitions themselves** — which Shopify has just open-sourced and committed to maintaining. This is the definition of "grab the moment."

---

## Integration architecture

### Skill adoption

Clone the 16 Shopify Toolkit skills into the Automatos skills repository. They live alongside existing skills (sentinel, researcher, writer, etc.) in the same registry.

**Each Shopify skill becomes:**
- A `skill.md` file in `orchestrator/skills/shopify/`
- A registered entry in the skills marketplace (`api/skills_management.py`)
- Assignable to any agent via the standard skill assignment flow
- Auto-updatable via git sync when Shopify pushes new versions

Skill list (approximate, to verify against Toolkit release):
- `shopify_product_management`
- `shopify_order_management`
- `shopify_customer_management`
- `shopify_inventory_management`
- `shopify_discount_management`
- `shopify_fulfillment_management`
- `shopify_analytics_reporting`
- `shopify_marketing_campaigns`
- `shopify_content_management`
- `shopify_theme_management`
- `shopify_app_management`
- `shopify_tax_compliance`
- `shopify_shipping_zones`
- `shopify_customer_support`
- `shopify_reviews_management`
- `shopify_storefront_seo`

### Execution layer

The Toolkit's `shopify-admin-execution` layer is wrapped as an Automatos tool:
- New tool category: `shopify_*` (alongside `platform_*`, `workspace_*`, `composio_*`)
- `ShopifyToolExecutor` class handles authentication via Shopify OAuth (per-workspace stored credentials)
- All Toolkit actions go through Automatos's verification + budget governance before execution
- Every tool call logs to heartbeat_results and optionally fires agent reports

### Authentication

Shopify OAuth flow integrated into Automatos workspace settings:
- Merchant installs Automatos app from Shopify App Store → OAuth redirect → store access token stored in workspace credentials table (encrypted)
- Token scoped to the workspace, not per-agent (all agents in the workspace share the credential)
- Token refresh handled automatically via existing credential encryption infrastructure

### Parallel: Composio vs Toolkit

Composio already provides Shopify integrations (~100+ actions). The Toolkit provides ~16 skill files on top of the same Admin API surface.

**Decision:** Use Toolkit as the **primary** Shopify interface because:
- Open-source, no SaaS dependency
- Shopify-maintained, auto-updates with API changes
- Skill format matches Automatos's skills model natively
- Lower cost (no Composio per-call overhead)

**Use Composio as fallback** for actions the Toolkit doesn't cover and for non-Shopify integrations (Meta Ads, Google Ads, Mailchimp, Klaviyo, etc.).

---

## How agents use the integration

### Example: Daily Business Brief agent

1. Heartbeat fires at 08:00 merchant local time
2. Agent loads Business Analyst skill + Shopify Analytics Reporting skill
3. Agent calls Toolkit actions: `shopify.get_sales_last_24h`, `shopify.get_traffic_sources`, `shopify.get_top_products`
4. Agent calls Composio actions: `meta_ads.get_spend`, `google_ads.get_spend`
5. Agent synthesizes into a brief, writes via `platform_submit_report`
6. Widget in Shopify admin renders the brief on next merchant login

### Example: Inventory Watchdog agent

1. Heartbeat fires every 4 hours
2. Agent loads Inventory Management skill
3. Agent calls `shopify.get_inventory_levels`, `shopify.get_sales_velocity`
4. Agent compares current stock + velocity + supplier lead times
5. If stockout risk detected: agent writes alert report, optionally creates draft purchase order via Toolkit
6. Merchant sees alert in admin widget, one-click approve

### Example: Conversational shopper chat widget

1. Shopper asks "do you have this in blue?"
2. Chat widget sends message to Automatos backend with shopper context (current page, cart, session)
3. Merchandising agent receives message, loads Product Management skill
4. Agent calls `shopify.search_products_by_variant(color="blue", similar_to=current_sku)`
5. Agent returns formatted product list with add-to-cart CTAs
6. Widget renders response with product cards

---

## What Automatos adds on top of the raw Toolkit

This is the "Automatos uniqueness" layer — features Shopify Toolkit alone does not provide.

1. **Multi-agent orchestration** — Toolkit has no agent concept. Automatos runs a team of specialized agents that collaborate on missions.
2. **Memory and learning** — Toolkit is stateless. Automatos agents remember merchant preferences, policies, past decisions.
3. **Verification layer** — Toolkit executes actions as requested. Automatos verifies them before execution, catches hallucinations, prevents costly mistakes.
4. **Budget governance** — Toolkit has no cost controls. Automatos tracks LLM spend and enforces budgets.
5. **Heartbeat / self-scheduling** — Toolkit is reactive. Automatos agents run autonomously on schedule.
6. **Workspace isolation** — Toolkit has no multi-tenancy. Automatos isolates each merchant completely.
7. **Widget SDK** — Toolkit has no UI. Automatos delivers work to merchants and shoppers through embeddable widgets.
8. **Mission Zero onboarding** — Toolkit has no setup flow. Automatos walks merchants through a 7-day concierge build.
9. **Cross-platform integration** — Toolkit is Shopify-only. Automatos connects Shopify to Meta Ads, email, support, analytics, content, everything.
10. **The A-Team** — Toolkit is DIY. Automatos provides human experts for onboarding.

**Marketing line:** "Shopify gave you the skills. Automatos gave you the team that uses them."

---

## Risks

| Risk | Mitigation |
|---|---|
| Shopify changes Toolkit license or open-source terms | We maintain a fork; Toolkit is MIT/Apache at launch, forking is explicitly allowed |
| Shopify builds their own multi-agent layer on top of Toolkit | Speed — ship first, own the category name, build switching costs via memory + workspace data |
| Toolkit skills have bugs or miss edge cases | Override with Automatos-specific skill versions in our registry; contribute fixes upstream |
| Shopify Admin API rate limits hit during busy traffic | Budget governor + per-widget rate limiting + action queuing via agent heartbeat |
| OAuth token leakage | Existing credential encryption infrastructure handles this; audit per tenant |

---

## Implementation plan

| Week | Task | Deliverable |
|---|---|---|
| 1 | Clone Toolkit into `orchestrator/skills/shopify/` | Skills visible in marketplace |
| 1 | Build `ShopifyToolExecutor` wrapping Toolkit actions | New tool category registered |
| 2 | Shopify OAuth integration into workspace credentials | Merchants can connect their store |
| 2 | Wire Toolkit actions through Automatos verification + budget | Safe execution layer |
| 3 | Seed Mission Zero wizard with Shopify-specific agent templates | Onboarding produces a working Shopify team |
| 3 | Test on Inbuild UK — confirm agent + Toolkit + real store works end-to-end | First real merchant using Toolkit via Automatos |
| 4 | Document the Shopify integration for merchant-facing docs | Published docs |

---

## Positioning note

When we talk about the Toolkit externally, we position Automatos as **the platform that makes the Toolkit usable by merchants who can't code.**

> "Shopify's AI Toolkit is amazing — if you're a developer who can wire agents, orchestration, memory, and UI around it. Automatos is the turnkey platform that does all of that for you. You get the Toolkit, plus a team of AI agents trained on your store, plus a widget library, plus a concierge onboarding — in one subscription."

This keeps us **aligned with Shopify** (complementary, not competitive) rather than looking like we're trying to replace anything they've built.
