# Shopify Merchant Operations Skills

> Operational knowledge skills for the merchant-facing agents.
> These complement the 16 Shopify Toolkit skills (developer-facing) with merchant business logic.

**Date:** 2026-04-12
**Status:** Spec — ready to write
**Location:** `automatos-skills/shopify/merchant/`

---

## Why these exist

The 16 Shopify Toolkit skills teach agents how to **write code** for Shopify (GraphQL, Liquid, Functions). They're designed for developers.

Merchant operations skills teach agents how to **run a store** — inventory logic, order triage, pricing strategy, customer retention. This is the knowledge that makes Automatos agents 10x more useful than Sidekick.

---

## Skill 1: Inventory Management

**File:** `inventory-management.md`

### What the agent learns

- **Reorder point calculation:** `reorder_point = (avg_daily_sales × lead_time_days) + safety_stock`
- **Safety stock formula:** `safety_stock = Z × σ_demand × √lead_time` where Z = 1.65 for 95% service level
- **Days of supply:** `current_stock / avg_daily_sales` — flag when < lead_time_days
- **Dead stock identification:** No sales in 60+ days, suggest markdown or bundle
- **Seasonal adjustment:** Weight recent 30-day sales velocity higher than 90-day average during seasonal transitions
- **ABC analysis:** Classify SKUs by revenue contribution (A = top 80%, B = next 15%, C = bottom 5%). Monitor A-items daily, B-items weekly, C-items monthly
- **Supplier lead time tracking:** Store per-supplier lead times in memory, update when actual differs from expected
- **Reorder recommendation format:** Always include: SKU, current stock, daily velocity, days of supply, suggested quantity, supplier, expected cost

### When the agent uses this

- Daily inventory mission (6 AM scan)
- When merchant asks about stock levels
- When generating reorder POs
- When flagging slow movers or dead stock

---

## Skill 2: Order Triage & Fulfillment

**File:** `order-triage.md`

### What the agent learns

- **SLA tiers:**
  - Express: fulfill within 4 hours of payment
  - Standard: fulfill within 24 hours
  - Pre-order: fulfill by promised date (check metafield `preorder_ship_date`)
- **Escalation triggers:**
  - Unfulfilled > 24h (standard) or > 4h (express) → alert merchant
  - Unfulfilled > 48h → escalate with customer impact assessment
  - Partial fulfillment > 72h → flag remaining items
- **Fraud signals:** Multiple high-value orders to same address with different names, new customer + expedited shipping + high value, billing/shipping mismatch on electronics
- **Fulfillment priority:** Sort by: SLA breach risk (descending) → order value (descending) → order age (ascending)
- **Return handling decision tree:**
  1. Is item within return window? → Check policy
  2. Is item in returnable condition? → Ask for photos if unsure
  3. Refund vs exchange? → Prefer exchange (higher retention)
  4. Restocking fee applies? → Only for opened electronics per policy
  5. Who pays return shipping? → Customer if buyer's remorse, store if defective
- **Cancellation rules:** Allow within 1 hour of order for unfulfilled orders. Fulfilled orders → must go through return process.

### When the agent uses this

- Hourly order monitoring mission
- When merchant asks about delayed orders
- When Support Agent escalates a customer issue
- When processing returns or cancellations

---

## Skill 3: Customer Retention & Lifecycle

**File:** `customer-retention.md`

### What the agent learns

- **Customer lifetime value (CLV):**
  - Simple: `avg_order_value × purchase_frequency × avg_customer_lifespan`
  - Calculate per-customer and per-segment
- **Churn signals:**
  - No purchase in 2× their average purchase interval
  - Declining order value over last 3 orders
  - Support ticket without follow-up purchase
  - Cart abandonment after browsing 5+ products
- **Segmentation model:**
  - Champions: High frequency + high value (top 10%)
  - Loyal: Regular purchasers, moderate value
  - At-risk: Were champions/loyal, now declining
  - New: First purchase in last 30 days
  - Dormant: No purchase in 90+ days
- **Re-engagement playbooks by segment:**
  - Champions → Early access, exclusive preview, loyalty program
  - At-risk → "We miss you" with personalized product rec based on purchase history
  - Dormant → Win-back discount (10-15%), time-limited
  - New → Post-purchase nurture sequence (day 3: "How's your purchase?", day 14: related products)
- **Metrics to track:** Repeat purchase rate, time between purchases, segment migration (monthly)

### When the agent uses this

- When merchant asks about customer retention
- Weekly customer health mission
- When generating re-engagement campaign lists for Marketing Agent
- When Business Analyst includes customer metrics in daily brief

---

## Skill 4: Pricing Strategy

**File:** `pricing-strategy.md`

### What the agent learns

- **Margin calculation:** `margin = (price - cost) / price × 100`
- **Margin targets by category:** Apparel 50-65%, electronics 15-30%, home goods 40-55%, consumables 30-45%. Adjust per store using uploaded pricing rules (RAG)
- **Competitive pricing rules:**
  - Match competitor price only if margin stays above floor (20% default)
  - Undercut by 5% on commodity items where differentiation is low
  - Premium pricing justified when: exclusive product, superior reviews, bundle value
- **Markdown strategy:**
  - Slow movers (no sales 30 days): 10% off
  - Dead stock (no sales 60 days): 25% off
  - Clearance (no sales 90 days): 40-50% off
  - Never markdown new arrivals (< 14 days listed)
- **Bundle pricing:** `bundle_price = sum(item_prices) × 0.85` (15% bundle discount default)
- **Dynamic pricing rules:**
  - Low stock (< 5 units) + high demand (> 2 sales/day) → hold price or increase 5%
  - High stock + low demand → consider markdown
  - Seasonal demand spike → hold price, increase ad spend instead
- **Price change audit:** Log all price changes with reason, old price, new price, margin impact. Merchant must approve changes > 20% in Phase 1.

### When the agent uses this

- Weekly pricing review mission
- When merchant asks about margins or competitive pricing
- When generating markdown recommendations for dead stock
- When creating bundle or promotion pricing

---

## Skill 5: Black Friday / Peak Season Playbook

**File:** `peak-season-playbook.md`

### What the agent learns

- **T-minus checklist (4 weeks before):**
  1. Analyse last year's peak data (top products, revenue, traffic sources)
  2. Inventory check: ensure top 20 products have 3× normal stock
  3. Flag products at stockout risk with lead time > 2 weeks
  4. Pre-create discount codes (test in staging)
  5. Prepare email/SMS campaign drafts
  6. Load test: check if hosting/CDN can handle 5× traffic
  7. Brief support agent with peak-season FAQ updates
  8. Set up real-time monitoring dashboard (orders/hour, conversion rate, error rate)

- **During peak:**
  - Monitor orders per hour vs last year's same-hour
  - Alert on conversion rate drops > 20% (possible site issue)
  - Auto-flag high-value orders for express fulfillment
  - Track ad spend ROI hourly — pause underperforming campaigns
  - Monitor inventory in real-time — disable "Add to Cart" when stock hits 0

- **Post-peak (48h after):**
  - Generate performance report (revenue, orders, AOV, conversion, top products)
  - Compare vs last year and vs forecast
  - Identify unfulfilled orders and clear backlog
  - Calculate campaign ROI
  - Draft "Thank you" follow-up for peak purchasers

### When the agent uses this

- On-demand when merchant says "prep for Black Friday" / "prep for holiday season"
- Automated T-minus missions (triggered by calendar)
- During peak: real-time monitoring missions
- Post-peak: performance analysis

---

## Skill 6: Returns & Refunds Handling

**File:** `returns-handling.md`

### What the agent learns

- **Return window rules:** 30 days standard (configurable per store via policy document)
- **Decision tree:**
  ```
  Customer requests return
    → Is item within return window?
      → No → Deny, explain policy, offer store credit as goodwill (manager approval)
      → Yes → Is item returnable? (check non-returnable list: underwear, custom items, perishables)
        → No → Deny with explanation
        → Yes → Exchange or refund?
          → Exchange → Process exchange, no restocking fee
          → Refund → Defective?
            → Yes → Full refund + free return shipping
            → No → Refund minus restocking fee (if applicable) + customer pays return shipping
  ```
- **Restocking fees:** 0% for defective, 10% for opened electronics, 0% for all other categories (configurable)
- **Return shipping labels:** Auto-generate via fulfillment API for defective items, customer-arranged for buyer's remorse
- **Refund timing:** Process within 48h of item receipt, notify customer
- **Metrics:** Track return rate per product (flag if > 15%), reason codes, refund vs exchange ratio

### When the agent uses this

- When Support Agent handles a return request
- When Operations Manager processes return queue
- Monthly returns analysis mission (flag high-return products)

---

## Skill 7: SEO for E-commerce

**File:** `seo-ecommerce.md`

### What the agent learns

- **Product page SEO:**
  - Title tag: `[Product Name] - [Key Feature] | [Store Name]` (50-60 chars)
  - Meta description: Benefit-led, include price if competitive, CTA (150-160 chars)
  - H1: Product name (one per page)
  - Image alt text: Descriptive, include product name + colour/variant
  - Schema.org Product markup: name, image, description, price, availability, reviews
- **Collection page SEO:**
  - Unique description per collection (150+ words)
  - Internal links to top products and related collections
  - Avoid thin content: add buying guides above product grid
- **Blog content strategy:**
  - Target long-tail keywords with purchase intent ("best [product type] for [use case]")
  - Minimum 800 words per post
  - Internal link to 2-3 relevant products naturally
  - Publish consistently (weekly minimum for SEO signal)
- **Technical SEO:**
  - Canonical URLs on all pages (Shopify handles this mostly)
  - Avoid duplicate content from /collections/all vs /collections/[name]
  - Submit sitemap via Google Search Console
  - Monitor Core Web Vitals (LCP, CLS, INP)
- **Schema.org types for Shopify:** Product, BreadcrumbList, FAQPage, BlogPosting, Organization

### When the agent uses this

- SEO/Content Agent writing blog posts
- When generating meta tags for products/collections
- When auditing site SEO health
- When creating Schema.org markup

---

## Skill 8: Supplier & Vendor Management

**File:** `supplier-management.md`

### What the agent learns

- **Supplier data model:** Store per-supplier: name, contact, lead time (days), minimum order quantity, payment terms, reliability score (% on-time deliveries)
- **Lead time tracking:** Record expected vs actual delivery dates. Update rolling average. Flag suppliers with > 20% late rate.
- **Purchase order generation:**
  ```
  PO includes:
  - PO number (auto-generated: PO-YYYYMMDD-XXX)
  - Supplier details
  - Line items: SKU, description, quantity, unit cost, total
  - Expected delivery date (today + supplier lead time)
  - Payment terms
  - Shipping instructions
  ```
- **Supplier SLA enforcement:**
  - Track: on-time delivery %, quality rejection rate, response time to queries
  - Alert when SLA drops below threshold (configurable, default: 90% on-time)
  - Suggest backup supplier when primary is underperforming
- **Cost optimisation:**
  - Track cost per unit over time per supplier
  - Flag price increases > 5%
  - Suggest bulk ordering when volume discount thresholds are close
  - Compare cost across suppliers for same-category products
- **Reorder automation:**
  - When inventory skill triggers reorder → generate PO draft
  - Route to merchant for approval (Phase 1)
  - Include: last order date, last unit cost, suggested quantity, expected total cost

### When the agent uses this

- When Inventory Watchdog triggers a reorder recommendation
- When merchant asks about supplier performance
- Weekly supplier review mission
- When generating PO drafts

---

## Skill Map: Which Agent Uses Which Skill

| Skill | Ops Manager | Support | Product Expert | Merchandiser | Review Analyst | Gift Concierge | SEO/Content | Biz Analyst | Inventory |
|---|---|---|---|---|---|---|---|---|---|
| Inventory Management | x | | | | | | | x | x |
| Order Triage | x | x | | | | | | x | |
| Customer Retention | x | | | x | | | | x | |
| Pricing Strategy | x | | | | | | | x | |
| Peak Season Playbook | x | x | | | | | | x | x |
| Returns Handling | x | x | | | | | | | |
| SEO for E-commerce | | | | | | | x | | |
| Supplier Management | x | | | | | | | | x |

The Operations Manager has access to all 8 skills. Widget agents get only the skills relevant to their domain.

---

## Integration with Shopify Toolkit Skills

The 16 Toolkit skills (developer-facing) are assigned to the 3 developer agents:
- App Architect: `shopify-admin`, `shopify-admin-execution`, `shopify-dev`, `shopify-partner`, `shopify-functions`, `shopify-payments-apps`
- Storefront Developer: `shopify-liquid`, `shopify-storefront-graphql`, `shopify-hydrogen`, `shopify-custom-data`, `shopify-customer`
- Extension Builder: `shopify-polaris-admin-extensions`, `shopify-polaris-app-home`, `shopify-polaris-checkout-extensions`, `shopify-polaris-customer-account-extensions`, `shopify-pos-ui`

The 8 merchant skills (this document) are assigned to the Operations Manager and widget agents.

No overlap. Clean separation. Developer agents get Toolkit skills. Merchant agents get operations skills.
