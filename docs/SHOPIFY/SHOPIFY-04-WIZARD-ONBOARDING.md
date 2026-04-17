# Mission Zero Wizard — Shopify-First Onboarding

**Status:** Research / product plan
**Owner:** Gerard
**Date:** 2026-04-12

---

## Principle

Automatos is open to anyone, but the wizard is currently **tuned for Shopify merchants**. That focus is a feature, not a limitation. Generic "build an AI team" onboarding has a catch-22 — blank canvas paralysis. Shopify-specific onboarding has a known buyer, a known pain, and a known target output.

Anyone can join. Not everyone gets the red carpet treatment. Shopify merchants do.

---

## The onboarding paths

### Path A — Shopify merchant (primary, concierge)
Merchant installs Automatos from Shopify App Store → OAuth to their store → Mission Zero wizard runs with Shopify context → A-Team kicks in within 2 hours → 7-day concierge build → paid subscription.

### Path B — Non-Shopify business (open door, self-serve)
Anyone signs up at automatos.app → Wizard offers Shopify path or "general business" path → If general, runs a lighter version of Mission Zero with URL intake + generic templates → Self-serve from there.

**Both paths exist. Path A is where we put the marketing budget and the A-Team time. Path B keeps us horizontal without diluting focus.**

---

## Path A — The Shopify merchant flow (90 minutes to first value)

### Step 0 — Install from App Store
- One click from Shopify App Store listing
- Standard Shopify OAuth
- Lands in Shopify admin sidebar with embedded Automatos wizard

### Step 1 — Intake (5 minutes)
Wizard asks:
- Store URL (auto-populated from OAuth)
- What kind of store is this? (free text — "fashion for men over 40", "vintage guitars", "handmade candles")
- What are your top 3 frustrations? (checkboxes — "customer support takes hours", "I don't have time to write blog posts", "inventory surprises me", etc.)
- How technical are you? (self-rated 1-5)
- Budget range for AI subscription (£99-£299-£799-£custom)

### Step 2 — The crawl (5 minutes, automated)
- Automatos scrapes the store (products, policies, FAQ, blog, reviews)
- Pulls Shopify Admin API data (sales velocity, order volume, inventory levels, customer count)
- Runs graphify on the combined corpus
- Builds a knowledge graph of the merchant's business

### Step 3 — The brief (10 minutes, agent-generated)
A top-level Business Analyst agent writes a **Mission Zero Brief** covering:
- What the store sells, to whom, at what scale
- Top 5 friction points identified from the data
- Recommended AI team composition (which agents, which skills, which tools)
- Recommended widget slate (which widgets to install first)
- 30/60/90-day improvement plan with measurable outcomes

Brief is presented in the Automatos admin and emailed to the merchant. This is the "holy fuck" moment — the merchant sees a consulting-grade strategic brief for their own business, generated in 10 minutes, for the price of a subscription.

### Step 4 — The A-Team handoff (same day)
- A human from the Automatos A-Team reviews the brief and the merchant's intake
- A-Team reaches out within 2 hours with: "Hi, I'm [name] from the Automatos team. I've looked at your brief. Here's what we'll build for you in the next 7 days."
- A-Team works inside the merchant's workspace — not on the merchant's side — building, tuning, refining
- Daily check-ins with the merchant, minor tweaks based on feedback
- By day 7: full AI team live, widgets deployed, first measurable result visible

### Step 5 — The 7-day build (concierge)
A-Team member executes the plan:
- Refines the 4-8 seeded Mission Zero agents into merchant-specific versions
- Installs and configures 3-6 widgets based on merchant priorities
- Loads merchant-specific documents (policies, SOPs, catalogs) into RAG
- Wires Composio integrations (Meta Ads, email, support, etc.) based on merchant's existing tool stack
- Runs daily heartbeats to verify the team is working
- Captures before/after screenshots for potential case study use

### Step 6 — Day 8 conversion
- Trial expires, merchant either pays or loses access
- If paid: A-Team schedules a weekly check-in for month 1, then monthly
- If not paid: automated offboarding, widgets go dark, graceful goodbye email offering to re-engage

---

## Path B — The generic business flow (self-serve, 30 minutes)

### Step 1 — Intake (same structure, Shopify-agnostic)
- Business URL
- Industry / type (dropdown: agency, law firm, SaaS, creator, consultancy, other)
- Top 3 frustrations
- Budget tier

### Step 2 — Crawl (automated)
- Scrape the URL, graphify, build knowledge graph
- No Admin API equivalent for non-Shopify — rely on web scrape only

### Step 3 — The brief (agent-generated, generic templates)
- Business Analyst agent writes a brief using generic business templates instead of Shopify-specific ones
- Narrower — it's based only on public information + the intake
- Still valuable ("here's your strategic brief in 10 minutes") but less concierge-intensive

### Step 4 — Self-serve build
- No A-Team handoff by default — merchant uses the platform to build their own team
- Mission Zero seeds 4 generic agents (strategist, researcher, writer, analyst)
- Widget library accessible via the same UI
- A-Team available as a paid add-on for non-Shopify users on Growth tier+

### Step 5 — Conversion
- Same 7-day trial
- Lower trial-to-paid expected (maybe 10% vs 20%+ for Shopify path)
- Still valuable — fills the horizontal market without distracting from Shopify focus

---

## Why Shopify gets the A-Team and general does not

- **Shopify merchants have a defined stack** — we know what they use, what the data looks like, what the pain is
- **Shopify data is structured** — Admin API gives us everything; generic businesses force us to scrape
- **A-Team effort is justified by LTV** — Shopify merchants are a homogenous, known persona
- **Generic businesses are too varied** — concierge onboarding for a law firm vs a creator vs an agency is three different products
- **Focus** — Phase 1 is Shopify; Phase 2 is horizontal. Pretending to do both at Phase 1 dilutes everything.

**Rule:** If you're not a Shopify merchant in Phase 1, you get the same self-serve experience as anyone else. A-Team is a Shopify-path benefit (or a paid upgrade). No apology needed.

---

## The wizard's current state vs what we need

Current wizard (in `orchestrator/api/wizard.py`):
- Takes a URL
- Scrapes, ingests, graphifies
- Seeds 4 generic agents (`_ensure_mission_zero_team`)
- Runs a 7-task mission
- Produces a brief

Gaps for Shopify-first wizard:
1. **No Shopify OAuth integration** — wizard is URL-only, doesn't pull Admin API data
2. **No vertical templates** — 4 agents are generic, not tuned for merchants
3. **Brief is generic** — doesn't understand Shopify-specific metrics, friction points, or opportunities
4. **No A-Team handoff mechanism** — no admin queue for A-Team to pick up new intakes
5. **No widget recommendation engine** — wizard doesn't suggest which widgets to install
6. **P1 + P2 blockers** — fire-and-forget pipeline + no per-intake workspace isolation mean the wizard cannot be trusted with paying merchants today

---

## Implementation plan

| Week | Task | Deliverable |
|---|---|---|
| 1 | Fix P1 (durable wizard) and P2 (per-intake workspace) — blocker for everything | Wizard survives container restart, each intake lives in its own workspace |
| 2 | Shopify OAuth integration into wizard intake flow | Merchant installs from App Store → wizard picks up OAuth token → pulls Admin API data |
| 2 | Shopify-specific agent seed templates in `_ensure_mission_zero_team` | Wizard seeds Shopify merchant team (Support, Product, SEO, Business Analyst, Inventory) |
| 3 | Shopify-specific brief template — uses Admin API data, not just web scrape | Brief reads like a consulting deliverable for a merchant |
| 3 | Widget recommendation engine — based on merchant intake, recommends 3-6 widgets | Merchant sees "we recommend installing X, Y, Z widgets" in the brief |
| 4 | A-Team admin queue — new Shopify intakes land in a queue for A-Team pickup | Admin-only tab in Automatos backend showing new intakes + A-Team assignment |
| 4 | A-Team assignment + daily digest workflow | A-Team members get a daily digest of their assigned intakes + progress |
| 5 | End-to-end test with Inbuild UK | Inbuild goes through the full Shopify-first wizard path, A-Team handoff works |

---

## The user's line, kept

> "MISSION ZERO should make my new clients think they are going to the MOON. We have a team of Opus 9.0s (joke) but GPT 5.4, Opus, superman behind the scenes to help them design the best Automatos team. They will shit their pants. Join Automatos - 7 days for free, we will build the platform for you, analyse your business, build your team, get you started. 7 days later we own them."

That's the exact energy of the Shopify-first wizard. It's not a form. It's a red carpet.

The generic path is still good — it opens the door to non-Shopify users who want to build their own AI team — but the marketing, the A-Team, and the emotional intensity of the onboarding all point at Shopify merchants in Phase 1.

---

## Admin-only A-Team tab (new feature)

Proposed addition to the Automatos admin UI:

- **Admin-only** — not visible to merchants
- Located under **Agents** tab alongside Roster, Configuration, Coordination, Recipes
- Shows:
  - **Active intakes** — Shopify merchants currently in Mission Zero trial
  - **Queue** — new intakes waiting for A-Team pickup
  - **Assigned to me** — intakes the current A-Team member is building
  - **Completed this week** — conversions, churn, outcomes
  - **Templates** — vertical playbooks (jewelry, fashion, home goods, electronics, etc.) that A-Team uses as starting points
- Each intake opens a workspace the A-Team member can operate inside — build agents, configure widgets, load documents, all without leaving the admin UI

This is the **operational backbone** of the concierge onboarding model. Without this, A-Team work is ad-hoc and unscalable.
