# Segment 07: Payment & Subscription Architecture

**Type:** Cross-cutting concern (monetization layer)
**Depends on:** Segment 05 (feature flag), Segment 07 (Stripe integration)
**Referenced by:** Segment 07, Segment 10 (Payouts), Segment 13 (Orchestration billing), Segment 12 (Composability revenue)

---

## What This Module Is

This module documents the complete monetization architecture for WebletGPT — how developers set prices, how users subscribe, how revenue is split, how payments work when weblets are composed or orchestrated, and how to activate the payment system when ready.

Everything described here is **designed but deferred**. The `ENABLE_PAYMENT_ENFORCEMENT` feature flag controls activation. At launch, all weblets are free. This module serves as the blueprint for when monetization is turned on.

> **Example of the full payment lifecycle:** Developer Priya creates "Essay Editor" and sets it to $8/month with a 7-day trial. User Tom discovers it on the marketplace (currently free). When payments are enabled, Tom sees a paywall: "$8.00/month — 7-day free trial." He clicks "Start Free Trial," completes Stripe Checkout, and chats for free during the trial. On day 8, his card is charged $8. Priya receives $8 minus the platform fee in her connected Stripe account. The cycle repeats monthly.

---

## How It Will Be Done

### Step 1 — Platform Payment Model

**Revenue flow:**
```
User pays $X/month
  → Stripe processes payment
  → Platform takes PLATFORM_FEE_RATE (TBD — exact percentage decided later)
  → Remainder goes to the developer
```

**Key constants (all TBD, stored as configurable values):**
- `PLATFORM_FEE_RATE` — Percentage the platform keeps (industry range: 10-20%)
- `MINIMUM_PRICE` — Minimum monthly price a developer can set ($2.00 suggested)
- `MINIMUM_PAYOUT` — Minimum balance for developer withdrawal ($10.00 suggested)
- `PAYOUT_SCHEDULE` — How often payouts are processed (weekly suggested)

> **Why are these TBD?** The exact pricing will be decided based on platform growth, competitive analysis, and developer feedback. The architecture supports any values — changing them requires updating a single constants file, not rewriting code.

### Step 2 — Stripe Connect Integration (Future)

When payments are enabled, the platform will use **Stripe Connect (Express)** for two-sided marketplace payments:

**How it works:**
1. Developer clicks "Set Up Payments" in their dashboard
2. They are redirected to Stripe's Express onboarding flow (handles identity verification, bank account linking, tax forms)
3. After completing onboarding, a StripeConnectedAccount record is created linking the developer to their Stripe account
4. When a user subscribes to the developer's weblet, the payment is processed through Stripe Connect:
   - Stripe handles the full payment
   - The platform fee is automatically deducted
   - The remainder is deposited into the developer's connected Stripe account
5. Payouts from Stripe to the developer's bank happen on a configurable schedule

**Why Stripe Connect Express?**
- The platform acts as **Merchant of Record** — handles tax compliance, refunds, and disputes
- Developers don't need to set up their own Stripe accounts or handle PCI compliance
- The Express type gives the platform control over the payment flow while minimizing developer friction
- Supports 40+ countries for developer payouts

> **Example:** Developer Alex in Germany completes Stripe Connect onboarding. A user in the US subscribes to his weblet for $10/month. Stripe converts the payment, deducts the platform fee, and deposits the remainder into Alex's German bank account in EUR — all automatically.

### Step 2b — Developer Platform Subscriptions

Developers themselves are also subscribers to the platform. 

**Standard Developer Plans (Pro/Business):**
- Paid via standard Stripe subscriptions
- Give the developer a monthly starting credit balance
- **Auto-Reload:** When the balance drops to 0, Stripe automatically charges $10 to buy 2,000 more credits. If this fails, their weblets are immediately suspended (Segment 14).

**Enterprise Developers (BYOK):**
- Pay a high flat SaaS fee via Stripe
- Provide their own OpenRouter API key
- Consume 0 platform credits (pass-through pricing)
- Restricted to Private Workspace weblets only

### Step 3 — Subscription Model

**Current plan (V1):** Monthly recurring subscriptions per weblet.

**Subscription lifecycle:**
```
User discovers paid weblet
  → Sees paywall with price and trial info
  → Clicks "Subscribe" or "Start Free Trial"
  → Redirected to Stripe Checkout
  → Enters payment info
  → Subscription created: TRIALING or ACTIVE
  → After trial ends: auto-converts to ACTIVE (card charged)
  → Monthly renewal: card charged, access continues
  → If payment fails: status → PAST_DUE (grace period)
  → If not resolved: status → CANCELED (access revoked)
  → User can cancel anytime: access continues until period ends
```

**State machine:**
```
NONE → TRIALING → ACTIVE → PAST_DUE → CANCELED
              ↘ ACTIVE → CANCELED (user cancels)
```

**Future pricing options (designed but not built yet):**
- **Annual subscriptions** — Discount for yearly commitment
- **Usage-based pricing** — Pay per chat message or per tool call
- **Tiered pricing** — Free tier (limited messages), Pro tier (unlimited), Enterprise tier (API access)
- **One-time payments** — Pay once for lifetime access
- **Bundle pricing** — Subscribe to multiple weblets at a discount

*(Note: Developer plans already use a hybrid model with monthly base + auto-reload usage billing, as defined in Segment 14).*

### Step 4 — Composability Payment Distribution

When a developer builds a composite weblet that uses other developers' weblets as children (Segment 12), revenue must be distributed fairly.

**The problem:** User subscribes to Composite Weblet C ($10/month). C uses Child Weblet A ($5/month) and Child Weblet B ($3/month) as tools. Who gets paid?

**Proposed revenue split (exact percentages TBD):**
```
User pays $10/month for Composite Weblet C
  → Platform fee: $10 × PLATFORM_FEE_RATE = $X
  → Remaining pool: $10 - $X
  → Developer of C (composite creator): receives a majority share
  → Developer of A: receives a proportional share based on A's standalone price
  → Developer of B: receives a proportional share based on B's standalone price
```

**How proportions are calculated:**
- Child prices are used as weights: A=$5, B=$3, total child weight = $8
- Developer A gets: (5/8) of the child allocation
- Developer B gets: (3/8) of the child allocation
- The split between composite creator and child developers is configurable

**Stored in:** `WebletComposition.config.revenueShare` JSON field

> **Example:** C charges $10. Platform takes 15% ($1.50). Remaining $8.50 split: C's developer gets 50% ($4.25), child developers share 50% ($4.25) proportionally — A's developer gets $2.66, B's developer gets $1.59.

**Open questions for later:**
- What if a child weblet is free? Does its developer still get a share?
- What if the composite price is lower than the sum of child prices?
- Should child developers approve being used in compositions?

### Step 5 — Orchestration Flow Billing

When a user runs a sequential or hybrid flow that includes paid weblets:

**V1 approach (when payments enabled):**
- The user must have an active subscription to EACH paid weblet in the flow individually
- Free weblets in the flow require no subscription
- The flow executor checks `checkAccess()` for each weblet before running it
- If any paid weblet fails the access check, the flow pauses and shows: "Step 3 requires a subscription to [Weblet Name] — Subscribe to continue"

**Future approaches:**
- **Flow-level subscription** — Subscribe to a flow for a bundled price
- **Per-execution pricing** — Pay per flow run instead of monthly
- **Usage-based** — Pay based on total tokens consumed across all weblets in the flow

> **Example (V1):** User Tom creates a flow: "Research Bot" (free) → "Blog Writer" ($5/month) → "SEO Optimizer" ($3/month). Tom needs subscriptions to Blog Writer and SEO Optimizer to run the full flow. Research Bot is free, so no subscription needed.

### Step 6 — Feature Flag Activation Checklist

When the platform is ready to enable monetization, follow this checklist:

1. **Pre-activation:**
   - [ ] Confirm `PLATFORM_FEE_RATE` value with stakeholders
   - [ ] Ensure Stripe is in live mode (not test mode)
   - [ ] Verify all webhook handlers work correctly
   - [ ] Set up Stripe Connect onboarding flow (if using Connect)
   - [ ] Ensure developers have had time to set prices in the builder
   - [ ] Update terms of service with payment terms
   - [ ] Test the full payment flow end-to-end in a staging environment

2. **Activation:**
   - [ ] Set `ENABLE_PAYMENT_ENFORCEMENT = true` in `lib/constants.ts`
   - [ ] Deploy to production
   - [ ] Verify paywall appears for paid weblets
   - [ ] Complete one test subscription with a real card

3. **Post-activation monitoring (48 hours):**
   - [ ] Monitor Stripe webhook delivery success rate
   - [ ] Check for failed payments or checkout errors
   - [ ] Verify developer balances are updating correctly
   - [ ] Monitor user complaints or confusion
   - [ ] Have a rollback plan (set flag back to `false`)

---

## After This Module Is Implemented, the Platform Will Have

1. **Clear monetization path** — Every piece of the payment puzzle is documented and designed
2. **Flexible pricing** — Architecture supports subscriptions, trials, usage-based, and bundles
3. **Fair revenue sharing** — Composability and orchestration billing are solved
4. **Zero-risk launch** — Everything is free at launch, monetization activates with one flag
5. **Developer confidence** — Developers can set prices and see their payment setup is ready

---

## Connections to Other Segments

- **Segment 05** — Introduces the `ENABLE_PAYMENT_ENFORCEMENT` flag and `checkAccess()`
- **Segment 07** — Builds the Stripe integration (Products, Checkout, webhooks)
- **Segment 10** — Payouts: developers withdraw their earnings (PayPal or Stripe payouts via Connect)
- **Segment 13** — Orchestration billing: how flows with paid weblets are handled
- **Segment 12** — Composability revenue: how child weblet developers are compensated
- **Segment 15** — Marketplace: pricing display on weblet cards, filter by free/paid
