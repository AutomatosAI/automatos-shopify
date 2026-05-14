# Client Discovery — INBUILD UK

**Merchant:** INBUILD UK — inbuilduk.com / innobuilduk.myshopify.com
**Discovery date(s):** 2026-05-10 (initial), 2026-05-11 (sections 2 + extras)
**Status:** in progress — sections 1, 3–12 still pending
**Source template:** `docs/SHOPIFY/CLIENT-DISCOVERY-TEMPLATE.md`

> Use this as the source of truth when configuring INBUILD UK's bot. Update as more answers come in.

---

## 1. Business in one paragraph

_(pending — fill in from initial conversation)_

**What we already know** (from inbuilduk.com homepage scrape on 2026-05-10):
- UK supplier of building ventilation, fire safety, and smoke control systems
- Products: rooflights, AOV/SHEV control panels, dampers, actuators, fans, fire detection, emergency lighting
- Audience: trade professionals + contractors (also some DIY / self-builders)
- Voice: technical credibility + plain-spoken; trade-friendly framing ("priced for the trade", "fast dispatch")
- Taglines visible: "Best Price on the Internet", "Trusted roof windows, built for performance and priced for the trade"

> Need to confirm with merchant: distribution model (drop-ship from manufacturers? own warehouse?), region scope (UK-only?), and any sub-brands.

---

## 2. Bot scope — what should it help with?

**Answered 2026-05-11.**

| Capability | Enabled | Notes |
|---|---|---|
| Product questions | ✅ | Specs, compatibility, "is this right for my project?" |
| Order tracking | ✅ | "where's my order?" via Shopify |
| Returns / refunds | ✅ | Explain policy only — no processing |
| **Stock checks** | ❌ | **"Not possible unless we interface with manufacturers."** INBUILD UK doesn't hold their own inventory — stock data sits with manufacturers. Bot must NOT promise live stock levels. Phrasing to use: "We'll need to check with our supplier — leave your number and we'll come back to you" or similar deflection. |
| Recommendations | ✅✅ | **Double-yes — high priority.** See §5 for detail; also covered in cart cross-sell below. |
| Bulk / trade enquiries | ✅ | Pricing for quantities, trade account signup |
| Technical / compliance questions | ✅ | Certifications (EN 12101-9 etc.), regs, fitting guides |
| General store info | ✅ | Opening hours, contact, delivery zones |

**Out of scope:** _(not specified — follow up)_

---

## 2a. Additional requirements raised by client (NOT in template — need PRD treatment)

The client raised three meaningful features in their "other" notes that go beyond v1 of the proactive widget engagement we sketched. These are real product asks; flagging here so they get costed properly rather than glossed over.

### Feature A — Page-aware proactive engagement
> "the bot needs to identify what page of the website the potential purchaser is on. The bot should pop up with questions about why product are you looking for, do you want a specific size"

**Status:** Already in PRD-007 scope (the proactive widget engagement work). See §4 of the template for trigger/frequency questions still to be answered.

**Implementation notes:**
- Read `window.Shopify.product` and template type from theme to pass page context to the bot
- The opening prompt is product-aware ("Looking at AOV panels — what's the application?")
- This is the foundational feature; B and C below depend on it

### Feature B — Tech support callback handoff
> "can the bot link you to a tech support who will call you if you enter your number? Don't know if we can link straight to the team? Also the team has limited capacity so may not be able to answer the call."

**Status:** New — not in template §7 (which assumed live-chat / email / ticket handoff). This is a phone-callback request flow.

**Open questions for the client:**
- Where do callback requests land? Email to a shared inbox? Shopify customer note? CRM (HubSpot, Salesforce, other)? Slack channel?
- Working hours? What does the bot tell shoppers who request a callback at 11pm?
- Service level — within how long should we promise a callback? ("Within X working hours" or "We'll be in touch")
- Capacity safety valve — if the team is genuinely too busy, what's the fallback? Email-only? Self-service guide?
- Do they want the bot to capture more than the phone number — name, product of interest, urgency?

**Recommendation:** v1 should be conservative — capture phone + name + product context, drop into an email/Slack/CRM destination they nominate, and have the bot say "*A member of our team will aim to call you back within [X] working hours. If urgent, [alternative].*" Manage expectations honestly given the team's capacity constraint.

### Feature C — Cart abandonment recapture + cart cross-sell + bulk discount offers
> "I also want the bot to try and track and recapture shopping carts left open. Upon entering shopping cart look to cross sell products and offer bulk sale options with discounts."

**Status:** New — splits into three sub-features:

**C1. Cart abandonment recapture (on-site only)**
- Trigger: shopper has items in cart but hasn't progressed to checkout after N minutes
- Action: bot pops up with cart context — "Need help finishing your order?" / offer to answer questions / link to checkout
- Caveat: this is **on-site only** — once the shopper closes the tab, we have no way to follow up via this widget. True cart-abandonment recovery (email after they leave) needs email capture + a Shopify email flow, which is a separate piece of work.

**C2. Cart-page cross-sell**
- Trigger: shopper lands on `/cart` page
- Action: bot proactively suggests complementary products (e.g. shopper has actuator → suggest matching control panel)
- Source of suggestions: needs to come from somewhere — manually curated pairings? Shopify's "frequently bought with"? RAG over catalog with product-type matching?
- Open question: should suggestions appear in chat, or as a separate inline "you might also need" widget?

**C3. Bulk pricing offers**
- Trigger: shopper viewing a product or cart, eligible for bulk discount (≥ N units)
- Action: bot mentions the bulk-buy threshold and offer
- **Hard dependency:** INBUILD UK needs to define the bulk-pricing rules. Shopify supports volume discounts via apps (Shopify Discounts API, third-party apps like Bold). The bot can REFERENCE these but cannot create them — they have to be configured in Shopify first.
- Open question: are bulk discounts currently set up in Shopify? If yes, are they automatic at checkout or do they require a discount code? If no, this needs to be configured before the bot can reference it.

**Implementation effort estimate:** C1 + C2 each ~1 day if A is built. C3 mostly depends on whether INBUILD UK already has bulk pricing structured in Shopify; if yes, ~0.5 day to wire the bot to read it; if no, that's a separate Shopify-config conversation first.

---

## 3. Brand voice & personality

_(pending)_

Starter draft based on inbuilduk.com scrape (already exists in chat history):
- Adjectives: technical, plain-spoken, helpful, never pushy
- Audience-matching: trade level for trade questions, plain language for DIY
- Avoid: corporate fluff, over-apologising
- Use sparingly when true: "priced for the trade", "fast dispatch", "in stock for next-day" (NB: stock claim flagged in §2)

> Confirm with merchant before finalising the agent persona.

---

## 4. Proactive engagement

**Direction confirmed** (client wants proactive, context-aware popups — see §2a feature A).

Still to answer:
- **§4b** — trigger (time-on-page? scroll depth? exit intent? mix?)
- **§4c** — frequency cap (once per product? per session? per day?)
- **§4d** — canned vs LLM-generated greeting (latency tradeoff)
- **§4e** — popup style (corner bubble vs card slide-in)
- **§4f** — dismissal persistence (session, day, navigation)

---

## 5. Product recommendations

**Direction confirmed** — double-yes priority, plus cart-page cross-sell (§2a feature C2).

Still to answer:
- Source of suggestions (same-category, same-vendor, bundle, curated rules, AI judgement)
- How many at once
- Show prices? Stock status? (NB stock caveat from §2)
- Anything that should NEVER be recommended

---

## 6. Knowledge sources

_(pending — need to know where their policies/specs/guides live)_

Question to ask: do they have product spec PDFs, installation guides, certification documents that should be loaded into the knowledge base?

---

## 7. Escalation to humans

**Partially answered** — they want callback flow (§2a feature B). Need to nail down callback destination and SLA.

Still to answer:
- After-hours messaging
- Specific phrases that always escalate
- Are they using any existing live-chat / ticketing tool (Gorgias, Zendesk, Intercom, HubSpot Chat) we should integrate with?

---

## 8. Privacy, compliance, consent

_(pending — they're UK-based so GDPR applies by default)_

To confirm:
- Cookie consent integration (chat widget already has `respect_consent` flag)
- Any regulated language they're sensitive to (fire safety claims, compliance language)
- Transcript retention OK to share with merchant?

---

## 9. Visual design

_(pending — pick brand colour from inbuilduk.com if not specified)_

---

## 10. Rollout & approval

**Partially known:**
- Test theme: "AI Testing" (unpublished, currently has chat widget enabled)
- App is installed on innobuilduk.myshopify.com
- Workspace + API key minted

Still to answer:
- Who signs off before pushing to published theme
- Target go-live date
- Day-to-day point of contact for tweaks

---

## 11. Success criteria

_(pending)_

---

## 12. Things we'll handle without bothering them

Standard template defaults apply (persona drafted from §1 + §3, knowledge base built from existing pages + uploads, tone calibration during week one, monthly review).

---

## Follow-up checklist before the next merchant conversation

Things we should bring up next time:

1. **Stock data sourcing** — confirm manufacturer-dependency story, and whether they want a "we'll check" flow vs. just deflecting the question.
2. **Callback handoff destination** — email, Slack, CRM, or other (Feature B)
3. **Callback SLA + capacity safety valve** (Feature B)
4. **Bulk pricing rules** — do they exist in Shopify today? Codes or automatic? (Feature C3)
5. **Cross-sell pairings source** — manually curated, AI, or "frequently bought with"? (Feature C2)
6. **Proactive trigger preferences** — time? scroll? exit intent? (Template §4b)
7. **Frequency cap** — once per session / day / product? (Template §4c)
8. **Brand colour + visual prefs** (Template §9)
9. **Success criteria** — what does 30-day success look like to them? (Template §11)
10. **Go-live decision-maker + target date** (Template §10)

---

## Implementation impact (for our planning, not the client)

The three new features (A, B, C) push the original "v1 proactive engagement" out of a 3–5 day estimate into roughly:

| Feature | Estimate (after A is built) | Hard dependency |
|---|---|---|
| A — Page-aware proactive popup | 3–5 days (foundation; the bulk of the original PRD-007 work) | None |
| B — Callback handoff | 1–2 days | Decision on destination |
| C1 — Cart abandonment recapture (on-site) | 1 day | A built |
| C2 — Cart-page cross-sell | 1 day | A built, suggestion source decided |
| C3 — Bulk pricing offers | 0.5–2 days | Bulk pricing configured in Shopify first |

Total: ~6–10 days for everything. Suggest building A as PRD-007 (the original scope), then B and C in a follow-up PRD-008 once we have the deferred answers.
