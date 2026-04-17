# Shopify Strategy — North Star

**Status:** Research / strategic brief
**Owner:** Gerard
**Date:** 2026-04-12
**Horizon:** 90 days

---

## One-line positioning

**Phase 1 (Shopify wedge):** "Run your Shopify business. Powered by Automatos."

**Phase 2 (horizontal reveal):** "Automatos is the LEGO to your business dreams."

Shopify is the beachhead, not the ceiling. We use it because (a) Inbuild UK is a real merchant we can test on, (b) Shopify's AI Toolkit launched 2026-04-09 and every serious app builder is now scrambling for the same category, (c) the platform distribution surface (App Store + theme HTML/Liquid + Shopify App Bridge) is perfect for the widget SDK we already have.

Horizontal positioning ("LEGO to your dreams") does not replace Shopify positioning — it follows it. Once Shopify merchants are succeeding, we reveal that Automatos runs their whole business, not just the store.

---

## The three-phase plan

### Phase 1 — Shopify wedge (next 90 days)
- Anchor case study: **Inbuild UK** as "the most AI-powered Shopify store on the planet"
- Ship 10-20 widgets under the "Powered by Automatos" banner
- Integrate with Shopify AI Toolkit (use the 16 skills we already have)
- Launch one Automatos app in the Shopify App Store
- Mission Zero wizard onboarding targets Shopify merchants specifically
- Pricing: £99 / £299 / £799 / custom, metered on shopper interactions

### Phase 2 — Horizontal expansion (month 4-9)
- Automatos brand becomes "LEGO for business AI"
- Marketplace opens to third-party widget/agent/skill developers
- Shopify remains a vertical, not the whole business
- Target verticals beyond Shopify: legal, real estate, creative agencies, hospitality
- Widget marketplace revenue share activates

### Phase 3 — Platform (year 2+)
- Automatos is the default way non-technical people build AI systems for their business
- Same shape as WordPress (websites), Shopify (stores), Notion (docs)
- The A-Team onboarding becomes a productized layer; templates replace most concierge work
- Widget network effect compounds: every "Powered by Automatos" footer is a distribution node

---

## Why we start with Shopify (not "pivot to Shopify")

1. **We have a real merchant to test on.** Inbuild UK. Friend. Real traffic. No scar tissue from failed demos.
2. **Timing window.** Shopify Toolkit is 3 days old. The category is unclaimed. First credible multi-agent ops layer wins the merchant mindshare.
3. **Distribution is built.** Shopify App Store + App Bridge + theme.liquid = three ways into every store, zero channel cost.
4. **Our SDK fits.** Shadow DOM means theme CSS can't break widgets. Zero runtime deps means we don't bloat storefronts. Per-widget `agentId` means one merchant can run 10 different agents across their site. *(Note: SDK audit on 2026-04-12 found 3 P0 bugs — agentId type mismatch, innerHTML XSS risk, GDPR sessionStorage issue — plus missing Liquid template. All fixable in week 1. See SHOPIFY-02 §"What's missing" for full list.)*
5. **The buyer is defined.** Shopify merchants are a known persona with a known pain (they don't have time to run the business) and a known budget (they already pay for 20+ apps monthly).

---

## Why we don't stop at Shopify

- Shopify is ~4.6M stores. Global SMB count is ~400M. The horizontal market is 100x bigger.
- Concentration risk: relying on one platform for distribution means Shopify owns our gate.
- The LEGO positioning is the real moat. Shopify is a feature of the LEGO system, not the whole box.
- Every Shopify merchant also runs a small business with email, invoices, research, content — all addressable by Automatos.

---

## Success metrics — 90 days

| Metric | Target | Why |
|---|---|---|
| Widgets shipped | 10 | Prove the SDK scales beyond chat + blog |
| Widgets live on Inbuild UK | 6-8 | Real receipts, demo video, App Store asset |
| Shopify App Store listing | Approved | Distribution unlocked |
| Trial sign-ups (Phase 1) | 200 | Validate Mission Zero onboarding at volume |
| Paid conversions | 30 | 15% trial-to-paid is healthy for SMB SaaS |
| "Powered by Automatos" footer impressions | 1M+ | Distribution flywheel starting |
| P1/P2 platform flaws fixed | 100% | Prerequisite — merchant-facing work can't run on fire-and-forget pipelines |

---

## What we explicitly do NOT do in Phase 1

- **Do not list each widget separately in the App Store.** One Automatos app, widget library lives inside it.
- **Do not offer a free tier.** 7-day trial is the free surface. No free forever. The unit economics don't survive it.
- **Do not white-label the Powered by badge** except on the top tier. The badge is the distribution flywheel.
- **Do not chase verticals beyond Shopify** until Phase 2. Focus beats breadth at this stage.
- **Do not rebuild what the SDK already does.** Shadow DOM, SSE, per-widget agent binding — all solved. Build widgets, not frameworks.

---

## Companion documents

- `SHOPIFY-01-INBUILD-PHASE-1.md` — Inbuild UK pilot plan
- `SHOPIFY-02-WIDGET-CATALOG.md` — 10-20 widget ideas, effort, value
- `SHOPIFY-03-TOOLKIT-INTEGRATION.md` — How Automatos integrates with Shopify AI Toolkit
- `SHOPIFY-04-WIZARD-ONBOARDING.md` — Mission Zero tuned for Shopify merchants
- `SHOPIFY-05-COMPETITORS.md` — Competitive landscape and differentiation
- `SHOPIFY-06-90-DAY-PLAN.md` — Week-by-week execution plan
