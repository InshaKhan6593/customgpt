# Segment 06: Payment Infrastructure (Designed, Deferred)

**Estimated effort:** 2.5 weeks
**Depends on:** Segment 05 (Chat Engine — checkAccess() must exist)
**Produces:** Complete Stripe payment flow — built, tested, and ready to activate via feature flag
**References:** MODULE-payment-subscription.md

---

## What This Segment Is

This segment builds the entire payment system — Stripe products, checkout sessions, subscription management, and webhook handling. However, **none of this is enforced at launch.** The `ENABLE_PAYMENT_ENFORCEMENT` flag (introduced in Segment 05) is set to `false`, which means:

- Developers CAN set prices in the builder (the UI exists)
- Stripe Products and Prices CAN be created (for testing)
- The paywall component EXISTS but renders nothing when the flag is off
- All webhook handlers WORK (testable via Stripe CLI)
- But users will NOT be charged or blocked from any weblet

When the platform is ready to monetize, flipping `ENABLE_PAYMENT_ENFORCEMENT` to `true` activates everything instantly.

> **Example (current state, flag=false):** Developer Alex sets his "Code Reviewer" weblet to $5/month in the builder. Behind the scenes, a Stripe Product and Price are created (for testing). User Jordan opens Code Reviewer and chats freely — no paywall appears because the flag is off. Alex can see on his dashboard that the price is set and ready.

> **Example (future state, flag=true):** Same setup, but now when Jordan opens Code Reviewer, the paywall appears: "$5.00/month — 7-day free trial — Subscribe." Jordan clicks Subscribe, completes Stripe Checkout, and gets immediate access. Alex sees $4.25 in revenue (after platform fee).

---

## How It Will Be Done

### Step 1 — Create Stripe Product and Price When Developer Sets Price

When a developer sets a monthly price in the builder and saves:

1. The builder sends a PATCH to update the weblet's `monthlyPrice` and `accessType`
2. If `accessType` is SUBSCRIBERS_ONLY and a price is set, the API calls Stripe to create a Product and a recurring Price
3. The Stripe Product ID and Price ID are saved back to the weblet record
4. If the developer later changes the price, a new Stripe Price is created (existing subscribers stay on the old price until their next renewal)

The developer sees: "Price set: $5.00/month. This will be enforced when monetization is enabled."

### Step 2 — Build the Paywall Component

The paywall is a UI overlay that appears when the chat API returns a 402 (Payment Required) status. It shows:

- The weblet name and description
- The monthly price
- Trial days (if any)
- Feature list: "Full access to AI chat", "All tools included", "Cancel anytime"
- A "Subscribe" or "Start Free Trial" button
- A "Restore" link for users who think they already subscribed

**Conditional rendering:** The paywall component checks `ENABLE_PAYMENT_ENFORCEMENT`. When the flag is `false`, the component returns `null` — it never renders. The builder's price field shows a note: "Price (will apply when monetization is enabled)."

### Step 3 — Implement Stripe Checkout Session

When a user clicks "Subscribe" on the paywall (once payments are enabled):

1. The frontend calls `POST /api/stripe/create-checkout`
2. The API finds or creates a Stripe Customer for the user
3. Creates a Stripe Checkout Session with the weblet's Price ID
4. Includes trial days if the developer configured them
5. Saves the user's payment method for future use
6. Redirects the user to Stripe's hosted checkout page
7. After successful payment, Stripe redirects back to the chat page

### Step 4 — Handle Stripe Webhooks

Build the webhook endpoint (`POST /api/webhooks/stripe`) that processes Stripe events:

| Event | What Happens |
|-------|-------------|
| `checkout.session.completed` | Create a Subscription record in the database (status: ACTIVE or TRIALING). Create a Transaction record. |
| `invoice.paid` | Update subscription period dates. Create a Transaction record. Credit the developer's balance (minus platform fee). |
| `customer.subscription.updated` | Sync the subscription status (active, past_due, canceled). |
| `customer.subscription.deleted` | Mark the subscription as CANCELED. |
| `invoice.payment_failed` | Mark the subscription as PAST_DUE. |

**Revenue calculation:** When an invoice is paid, the platform takes the configured fee (stored in `PLATFORM_FEE_RATE` — amount TBD) and credits the remainder to the developer's balance. The exact fee percentage will be decided later.

### Step 5 — Build Stripe Customer Portal Integration

Allow users to manage their subscriptions through Stripe's hosted portal:
- View active subscriptions
- Update payment method
- Cancel a subscription
- View invoice history

Accessible from the user's profile page at `/(user)/profile/subscriptions`.

### Step 6 — Test the Complete Flow

Even though payments are deferred, the entire flow must be testable:

1. Use Stripe test mode API keys
2. Developer sets a price in the builder → Stripe Product/Price created (verify in Stripe Dashboard)
3. Temporarily set `ENABLE_PAYMENT_ENFORCEMENT = true` locally
4. User opens the weblet → paywall appears
5. User clicks Subscribe → Stripe Checkout opens (test card: 4242 4242 4242 4242)
6. Complete payment → redirected to chat → access granted
7. Verify webhook creates Subscription and Transaction records
8. Reset the flag to `false` for production deployment

---

## Files to Create

```
app/api/
├── stripe/
│   ├── create-checkout/route.ts      ← Create Stripe Checkout session
│   ├── create-product/route.ts       ← Create Stripe Product + Price for a weblet
│   ├── cancel-subscription/route.ts  ← Cancel a user's subscription
│   └── customer-portal/route.ts      ← Redirect to Stripe Customer Portal
├── webhooks/
│   └── stripe/route.ts               ← Webhook handler for all Stripe events

components/monetization/
├── paywall.tsx                        ← Paywall overlay (hidden when flag is false)
├── pricing-card.tsx                   ← Price display with trial info
├── subscribe-button.tsx               ← "Subscribe" or "Start Free Trial" button
└── subscription-status.tsx            ← Shows subscription status in chat header

lib/stripe/
├── client.ts                          ← Stripe SDK singleton
├── create-product.ts                  ← Create Stripe Product + Price
├── create-checkout-session.ts         ← Create Checkout session
└── webhook-handlers.ts                ← Handler functions for each event type
```

---

## Acceptance Criteria

- [ ] Developer can set monthly price ($2.00 minimum) in weblet builder
- [ ] Setting price creates Stripe Product + Price via API (visible in Stripe Dashboard)
- [ ] **When ENABLE_PAYMENT_ENFORCEMENT is false:** paywall never renders, all weblets are accessible
- [ ] **When ENABLE_PAYMENT_ENFORCEMENT is true:** paywall shows for paid weblets without subscription
- [ ] Paywall shows price, trial days, and Subscribe button
- [ ] Stripe Checkout flow works end-to-end in test mode
- [ ] Webhook `checkout.session.completed` creates Subscription record
- [ ] Webhook `invoice.paid` creates Transaction + credits developer balance (minus platform fee)
- [ ] Webhook `customer.subscription.updated` syncs status
- [ ] Webhook `customer.subscription.deleted` marks as CANCELED
- [ ] Webhook `invoice.payment_failed` marks as PAST_DUE
- [ ] Stripe Customer Portal accessible for subscription management
- [ ] Builder price field shows "Price (will apply when monetization is enabled)" when flag is false
- [ ] All Stripe API calls use test mode keys during development
- [ ] `PLATFORM_FEE_RATE` stored as a configurable constant (not hardcoded)

---

## After Completion, the Platform Will Have

1. **Complete payment infrastructure** — Stripe Products, Prices, Checkout, webhooks, subscription lifecycle — all built and tested
2. **Feature flag control** — A single constant flip activates all monetization
3. **Developer pricing** — Developers can set prices now, and those prices will take effect when monetization is enabled
4. **User protection** — No user is charged anything until the flag is intentionally turned on
5. **Ready for MODULE-payment-subscription** — The detailed payment architecture (Stripe Connect, revenue splits, composability billing) builds on top of this foundation

---

## Environment Variables to Add

```env
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Webhook delivery failures | Stripe retries for up to 3 days. Implement idempotency (check if subscription exists before creating). |
| Feature flag accidentally turned on | Add a check in CI/CD that confirms the flag is false for production. Document clearly. |
| Stripe test vs live mode confusion | Use environment-specific keys. Show "TEST MODE" banner in dev. |
| Platform fee not confirmed | Store as constant. Easy to change before enabling payments. |
