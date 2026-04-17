# Shopify Strategy — Research Document Index

**Date:** 2026-04-12
**Status:** Research / strategic brief set
**Context:** Written after a 100-hour week. Gerard will forget the details by morning. These documents capture the Shopify-first pivot plan so the strategy survives sleep.

---

## Read order

1. **[SHOPIFY-00-NORTH-STAR.md](./SHOPIFY-00-NORTH-STAR.md)** — The top-level strategy. Phase 1 (Shopify wedge) → Phase 2 (horizontal LEGO) → Phase 3 (platform). Start here.

2. **[SHOPIFY-01-INBUILD-PHASE-1.md](./SHOPIFY-01-INBUILD-PHASE-1.md)** — The Inbuild UK pilot plan. Widgets to deploy, agents to seed, timeline, receipts to capture, success criteria. This is the anchor case study.

3. **[SHOPIFY-02-WIDGET-CATALOG.md](./SHOPIFY-02-WIDGET-CATALOG.md)** — The 10-20 widget catalog. Tier 1-4 widgets, effort estimates, agent bindings, pricing gates, SDK gaps.

4. **[SHOPIFY-03-TOOLKIT-INTEGRATION.md](./SHOPIFY-03-TOOLKIT-INTEGRATION.md)** — How Automatos integrates with Shopify AI Toolkit (launched 2026-04-09). Skill adoption, execution layer, authentication, the 10 things Automatos adds on top of the raw Toolkit.

5. **[SHOPIFY-04-WIZARD-ONBOARDING.md](./SHOPIFY-04-WIZARD-ONBOARDING.md)** — Mission Zero wizard tuned for Shopify merchants. Path A (Shopify concierge) vs Path B (generic self-serve). The A-Team admin tab. 90-minute to first value.

6. **[SHOPIFY-05-COMPETITORS.md](./SHOPIFY-05-COMPETITORS.md)** — Honest competitive landscape. Tier A (Shopify's own AI), Tier B (App Store apps), Tier C (agent frameworks), Tier D (no-code builders). What nobody else does. What competitors do better. The moat summary.

7. **[SHOPIFY-06-90-DAY-PLAN.md](./SHOPIFY-06-90-DAY-PLAN.md)** — Week-by-week execution plan. Month 1 foundation, Month 2 widget expansion, Month 3 launch. Dependencies, success metrics, "oh shit" scenarios.

8. **[SHOPIFY-07-LEGO-POSITIONING.md](./SHOPIFY-07-LEGO-POSITIONING.md)** — The brand positioning. Why "LEGO to your dreams" is the real tagline. Phase 1 vs Phase 2 language rules. The mantra. The long game.

### Agent & Operations Design (added 2026-04-12)

9. **[SHOPIFY-AGENT-DESIGN.md](./SHOPIFY-AGENT-DESIGN.md)** — Why Automatos agents are better than the raw Toolkit. Use cases, architecture, comparison.

10. **[SHOPIFY-AGENTS-SPEC.md](./SHOPIFY-AGENTS-SPEC.md)** — 4 core agents (Operations Manager, App Architect, Storefront Dev, Extension Builder). Personas, skills, tools, sample prompts.

11. **[SHOPIFY-WIDGET-AGENTS.md](./SHOPIFY-WIDGET-AGENTS.md)** — 8 widget agent templates. Scoped instances of Operations Manager: Support, Product Expert, Merchandiser, Review Analyst, Gift Concierge, SEO/Content, Business Analyst, Inventory Watchdog.

12. **[SHOPIFY-MERCHANT-SKILLS.md](./SHOPIFY-MERCHANT-SKILLS.md)** — 8 merchant operations skills (inventory, order triage, retention, pricing, peak season, returns, SEO, supplier management). Complements the 16 Toolkit dev skills.

13. **[SHOPIFY-MCP-EVALUATION.md](./SHOPIFY-MCP-EVALUATION.md)** — Evaluation of existing open-source Shopify MCP servers. Recommendation: containerize `callobuzz/cob-shopify-mcp` (64 tools, 600 tests, YAML-extensible) in Phase 2.

14. **[SHOPIFY-DECK-BRIEF.md](./SHOPIFY-DECK-BRIEF.md)** — 10-slide deck brief for the Inbuild UK pilot pitch.

### PRD

15. **[PRD-SHOPIFY-PLATFORM.md](./PRD-SHOPIFY-PLATFORM.md)** — Master PRD tracking all workstreams: prerequisites, scaffold, agents, skills, MCP, Inbuild pilot, launch.

---

## One-paragraph recap (for when you forget)

Shopify launched their AI Toolkit on 2026-04-09. Automatos was almost designed for this moment — we have 16 Shopify-aligned skills, a widget SDK that matches Shopify's HTML/Liquid themes, Mission Zero concierge onboarding, and a real merchant (Inbuild UK) we can test on. Phase 1 is 90 days of Shopify mode: fix P1-P5 flaws, integrate the Toolkit, ship 10+ widgets on Inbuild, tune Mission Zero for merchants, launch on the Shopify App Store with Inbuild as the case study. Phase 2 is horizontal — Automatos becomes "the LEGO to your business dreams" for any SMB, any vertical. Shopify is the wedge, not the whole business. The tagline for Phase 1 is "Run your Shopify business. Powered by Automatos." The tagline for Phase 2 is "LEGO to your dreams." Don't mix them. Don't pivot — layer.

---

## SDK Audit (2026-04-12)

A full code review of `automatos-widget-sdk/` was performed against Shopify's Theme App Extension requirements. The architecture (Shadow DOM, IIFE loader, zero deps, CSS custom properties, SSE streaming) is the right foundation. Three ship-blocking bugs were found (agentId type mismatch, innerHTML XSS risk in blog widget, GDPR sessionStorage violation), plus a missing Liquid app embed block template. Full gap list with priorities (P0-P4) added to **SHOPIFY-02-WIDGET-CATALOG.md §"What's missing"**. P0 fixes added to **SHOPIFY-06-90-DAY-PLAN.md** week 1 checklist. New risks added to **SHOPIFY-01-INBUILD-PHASE-1.md** risk table.

---

## What's not in these documents

- **The P1-P5 platform fixes.** Gerard is managing those separately. Tracked in task list #21-25. Prerequisite to everything here.
- **Mission Zero template expansion** (the "more sections" feedback). Tracked as "Deferred" in mission-zero-flaws.md memory.
- **Widget marketplace third-party developer portal.** Nice to have. Not critical for Phase 1.
- **International expansion.** UK/US only for Phase 1.
- **Unit economics deep dive.** Pricing is proposed but not modeled. Do this before the App Store launch — week 9 at the latest.
- **The acquisition question.** Addressed briefly in competitor doc. Short answer: don't plan for it, plan to be Klaviyo-sized independently.

---

## Tomorrow-Gerard checklist

When you wake up and read this:

- [ ] Read SHOPIFY-00-NORTH-STAR first. 5 minutes.
- [ ] Read SHOPIFY-06-90-DAY-PLAN second. 10 minutes.
- [ ] Skim the rest as needed.
- [ ] Finish the P1-P5 fixes. Non-negotiable prerequisite.
- [ ] Sign up as Shopify Partner (10 minutes, free).
- [ ] Confirm with Inbuild UK owner that they're game for the pilot.
- [ ] Schedule one uninterrupted week to finish P1/P2 before any Shopify work begins.
- [ ] Start a Shopify-mode branch (`feat/shopify-mode`) as the umbrella for the 90-day work.
- [ ] Forward this index to anyone else on the team who needs the context.

---

## The line to remember

> **"We are the LEGO to your dreams."**

Write it on the wall. Don't let it slip back into "that thing I said once."

Now go finish the wine.
