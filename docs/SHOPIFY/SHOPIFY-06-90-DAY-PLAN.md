# Shopify Mode — 90-Day Execution Plan

**Status:** Research / execution plan
**Owner:** Gerard
**Date:** 2026-04-12
**Start:** After P1-P5 platform flaws are fixed (Gerard managing separately)

---

## The frame

90 days. One outcome: Automatos is live on the Shopify App Store with Inbuild UK as the anchor case study, 10+ widgets shipped, Mission Zero wizard tuned for merchants, A-Team onboarding running. "Shopify mode" means focus is narrowed — no feature work that doesn't support the Shopify wedge.

**Prerequisite:** P1 (durable wizard) and P2 (per-intake workspace isolation) must land before any merchant-facing work begins. Non-negotiable. Fire-and-forget pipelines in front of paying merchants is a brand-kill risk.

---

## Month 1 — Foundation (weeks 1-4)

### Week 1 — Platform hardening + SDK bug fixes + Shopify Partner signup
- [ ] P1 durable wizard pipeline deployed
- [ ] P2 per-intake workspace isolation deployed
- [ ] **SDK P0 fixes (before any Inbuild deploy):**
  - [ ] Fix `agentId` type mismatch in React wrapper (`number` → `string`)
  - [ ] Add client-side HTML sanitization to blog widget `PostDetail`
  - [ ] Add Shopify privacy API check before sessionStorage writes
  - [ ] Build Liquid app embed block template (`shopify-app-extension/blocks/`)
  - [ ] Remove dead `createTypingIndicator` export
- [ ] Shopify Partner account registered (10 minutes)
- [ ] Read App Store requirements end-to-end
- [ ] Review Shopify Toolkit repository and license
- [ ] Clone Toolkit skills into `orchestrator/skills/shopify/`
- [ ] Decision: Toolkit primary, Composio fallback

### Week 2 — Shopify integration plumbing
- [ ] `ShopifyToolExecutor` wrapping Toolkit actions
- [ ] Shopify OAuth flow integrated into workspace credentials
- [ ] Test OAuth → API call → agent response end-to-end on Inbuild
- [ ] Wire Toolkit actions through Automatos verification + budget governance
- [ ] Document Shopify integration for internal reference

### Week 3 — Mission Zero wizard for Shopify
- [ ] Shopify-specific intake form (store URL, pain points, budget, vertical)
- [ ] Shopify-specific agent seed templates (Support, Product Expert, SEO, Business Analyst, Inventory)
- [ ] Shopify-specific brief template pulling Admin API data
- [ ] Widget recommendation engine — brief suggests which widgets to install
- [ ] Test full wizard flow on Inbuild UK

### Week 4 — First widgets on Inbuild
- [ ] Chat FAB widget live on Inbuild storefront (Support Agent)
- [ ] Inline Product Q&A widget live on Inbuild PDPs (Product Expert Agent)
- [ ] Capture first screenshots and short video clips
- [ ] Merchant feedback loop with Inbuild owner
- [ ] Daily heartbeats producing real agent reports

**End of Month 1 deliverable:** Automatos is integrated with Shopify, wizard produces merchant-ready briefs, two widgets are live on Inbuild generating real shopper interactions.

---

## Month 2 — Widget expansion + A-Team (weeks 5-8)

### Week 5 — Blog widget + content agent
- [ ] Finish `@automatos/blog-widget` PRD (11 user stories)
- [ ] Blog widget live on Inbuild `/blog`
- [ ] SEO/Content Agent seeded, heartbeat fires weekly, publishes first 3 posts
- [ ] Verify SEO metadata, social sharing, mobile rendering

### Week 6 — Admin widgets via App Bridge
- [ ] Daily Business Brief admin widget live in Inbuild Shopify admin
- [ ] Inventory Watchdog admin widget live
- [ ] App Bridge integration pattern documented for future admin widgets

### Week 7 — A-Team admin tab + operational backbone
- [ ] Admin-only A-Team tab in Automatos backend (Active intakes / Queue / Assigned / Completed / Templates)
- [ ] A-Team assignment workflow
- [ ] Daily digest email for A-Team members
- [ ] Test A-Team handoff pattern internally

### Week 8 — More widgets
- [ ] Review Summarizer widget on Inbuild
- [ ] Gift Finder Quiz widget on Inbuild
- [ ] 6 widgets live, approaching halfway to 10-20 goal
- [ ] Per-widget metric capture started (conversion, deflection, revenue)

**End of Month 2 deliverable:** 6 widgets live on Inbuild, A-Team operational tab running, real metric impact captured for at least 3 widgets.

---

## Month 3 — Launch prep (weeks 9-12)

### Week 9 — Content and case study
- [ ] Inbuild case study written (real numbers, real quotes, real screenshots)
- [ ] 1-hour walkthrough video produced
- [ ] App Store listing copy drafted
- [ ] Landing page at automatos.app/shopify drafted
- [ ] Pricing page finalized (£99/£299/£799/custom)

### Week 10 — App Store submission
- [ ] Automatos app submitted to Shopify App Store
- [ ] Privacy policy, data handling docs, security review completed
- [ ] Screenshots and assets uploaded
- [ ] Listing preview reviewed by Shopify partner manager (if engaged)
- [ ] Built for Shopify badge application submitted

### Week 11 — More widgets + Inbuild completion
- [ ] Abandoned Cart widget on Inbuild
- [ ] Conversational Shopper widget on Inbuild
- [ ] Visual Search widget (stretch) on Inbuild
- [ ] 9-10 widgets live, nearing goal
- [ ] Inbuild case study video re-recorded with updated widget slate

### Week 12 — Launch week
- [ ] Shopify App Store listing goes live
- [ ] Launch announcement: blog post, Twitter thread, LinkedIn, Product Hunt
- [ ] Launch email to waitlist (if built during months 1-2)
- [ ] First 20 merchant signups through the App Store
- [ ] A-Team runs concierge onboarding for first merchants
- [ ] Monitor error rates, budget usage, conversion rates hourly for first 48 hours

**End of Month 3 deliverable:** Listing live, 20 paying Shopify merchants onboarded, Inbuild case study is the hero asset, metrics flywheel started.

---

## Parallel workstreams (throughout 90 days)

### Content and marketing
- Weekly thread / post on launch progress (build in public)
- Inbuild owner interview / testimonial
- Partner outreach: Shopify partner managers, influencers, merchant communities
- SEO content: "Best AI for Shopify", "Shopify AI Toolkit explained", "How to run a Shopify store with AI"

### Widget SDK improvements
- **P0 bug fixes (week 1, before Inbuild deploy):**
  - Fix `agentId` type mismatch (React passes `number`, core expects `string`) — 15 min
  - Add client-side HTML sanitization to blog widget `PostDetail` (currently raw `innerHTML`) — half-day
  - Add Shopify privacy API check (`window.Shopify.customerPrivacy`) before sessionStorage writes — half-day
  - Build Liquid app embed block template (`shopify-app-extension/blocks/` with `{% schema %}`) — half-day
  - Remove dead `createTypingIndicator` export — 15 min
- Inline chat mount (containerSelector for chat widget) — week 1
- PDP context injection (SKU awareness for product page widgets) — week 2
- App Bridge support for admin widgets — week 6
- Per-session rate limiting — week 7
- Widget telemetry — week 8
- Theme auto-match — week 9
- CSP nonce support for strict Shopify themes — week 9
- Multiple widget instance support (same app block in multiple sections) — week 7
- SSE reconnection and request retry with backoff — week 5
- Shopify section re-render handling (MutationObserver) — week 6
- i18n support (locale config or Shopify locale detection) — week 10
- Extract duplicated code (`h()` helper, `formatDate`, `clearElement`) to shared package — week 2
- Fix ConversationManager in-place mutations — week 2
- Widget test coverage to 80%+ (currently 22 tests, core only) — ongoing, target week 8

### Agent template library
- Shopify-vertical seed templates (fashion, electronics, home goods, food, beauty)
- Each vertical gets: adjusted agent roster, adjusted widget recommendations, vertical-specific playbooks
- A-Team uses these as starting points, not from-scratch builds

### Marketplace and third-party development
- Widget marketplace opens to third-party developers (stretch — if time allows)
- First third-party widget listed in the Automatos marketplace (target: month 3)

---

## Dependencies and blockers

| Blocker | Owner | Resolution needed by |
|---|---|---|
| P1 durable wizard pipeline | Gerard | Week 1 |
| P2 per-intake workspace isolation | Gerard | Week 1 |
| **SDK P0 bug fixes (3 bugs + Liquid template)** | Gerard | **Week 1 (before Inbuild deploy)** |
| P3 retry with verifier critique | Gerard | Week 4 (nice to have) |
| P4 budget governor hard-stop | Gerard | Week 8 (before paid merchants) |
| P5 HITL escalation | Gerard | Week 8 |
| Shopify Partner approval | External | Week 1 (automatic) |
| Shopify App Store review | External | Weeks 10-12 (plan for 4-8 weeks) |
| Toolkit license clarification | External | Week 1 (read license, no external dependency) |

---

## Success metrics

| Metric | Target | Tracked by |
|---|---|---|
| Widgets shipped | 10 | Count in widget catalog |
| Widgets live on Inbuild | 6-8 | Inbuild dashboard |
| App Store submission | Submitted week 10, approved week 12 | Shopify Partner portal |
| Trial sign-ups | 200 | Automatos admin |
| Paid conversions | 30 | Stripe + Automatos admin |
| "Powered by Automatos" impressions | 1M+ | Widget telemetry |
| Inbuild case study | Published | automatos.app |
| A-Team onboardings completed | 20 | A-Team admin tab |
| P1-P5 flaws resolved | 100% | Task tracker |

---

## What we explicitly defer past day 90

- Horizontal expansion (non-Shopify verticals) — Phase 2 work
- Widget marketplace third-party developer portal — nice to have, not critical
- White-label enterprise tier polish — Phase 2
- International (non-UK, non-US) merchant support — Phase 2
- Advanced verticals (B2B wholesale, multi-currency edge cases) — Phase 2
- Product Hunt big launch — saved for Phase 2 when we have more merchants

---

## The "oh shit" scenarios

Things that could blow up the plan. Pre-mortems.

1. **Shopify rejects the App Store listing.** → Common for first submissions. Iterate based on review feedback, resubmit within 1-2 weeks. Don't panic. Keep Inbuild live as the case study and run direct-sales in parallel.

2. **Inbuild owner pulls out or gets frustrated.** → Have a backup friendly merchant lined up by week 4. Don't put 100% of case study eggs in one basket.

3. **LLM costs explode on a busy Inbuild day.** → Budget governor (P4) must land before week 5. Hard cap at merchant tier limits.

4. **A Shopify AI competitor launches a copycat before we ship.** → Speed. Ship what's ready, don't polish endlessly. First to market with the category name wins.

5. **Toolkit changes licensing or deprecates skills.** → Fork the Toolkit at the SHA that works. Own a stable version. Contribute fixes upstream.

6. **Platform bugs surface under merchant load.** → Triage priority: anything touching paying merchants is P0. Have an on-call rotation for launch week.

7. **Mission Zero wizard produces a bad brief for a real merchant.** → A-Team reviews every brief before it goes to the merchant in Phase 1. Human gate prevents the bad-first-impression disaster.

---

## The vibe check

This plan is aggressive but achievable given what's already built. The work is integration + polish + content + launch, not net-new platform development. The LEGO pieces exist. The 90 days is about assembling them into a Shopify-shaped set that Shopify merchants can install, use, and pay for.

The biggest risk is not technical — it's focus. Shopify mode means saying no to everything that doesn't serve the wedge. No new verticals, no new features outside Shopify, no tangents. 90 days of ruthless focus, then Phase 2 opens up.

After 90 days: Inbuild UK is the most AI-powered Shopify store in the world. The Automatos App Store listing is live. A real business has been built on top of a real wedge. Then we go horizontal — and the story becomes "the LEGO to your business dreams."
