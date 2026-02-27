# Segment 10: Payouts & Creator Economics

**Estimated effort:** 1.5 weeks
**Depends on:** Segment 09 (Creator Dashboard — balance data visible)
**Produces:** Complete payout system with PayPal withdrawals, balance tracking, transaction history, and PayPal email confirmation

---

## Goal

Enable creators to withdraw their earnings. Creators view their balance (accumulated from subscription revenue minus platform fee), request a withdrawal to PayPal, confirm their PayPal email, and receive funds within 24 hours.

---

## What Already Exists (from Segments 01-08)

```
Database:
  User.balance — Decimal field, updated by Stripe webhook on invoice.paid (Segment 07)
  Transaction — logs every subscription payment with amount, fee, status
  Payout — model exists with creatorId, amount, paypalEmail, status, timestamps
API:
  /api/payouts (GET, POST) — stubs from Segment 03
Dashboard:
  Creator can see weblet revenue in analytics (Segment 09)
```

**Revenue flow already working:**
```
User pays $8/month → Stripe webhook fires → Transaction created →
Creator balance incremented by $6.80 (after 15% platform fee)
```

**What you build:** The "withdraw" side — letting creators get that $6.80 out to their PayPal.

---

## Important: PayPal Business Account Required

The PayPal Payouts API requires:
1. A **PayPal Business account** (not personal)
2. **Explicit approval** from PayPal to use the Payouts API
3. This approval process can take **1-3 weeks**

**Action:** Apply for PayPal Payouts API access IMMEDIATELY when starting this segment. Use PayPal Sandbox for development while waiting for production approval.

---

## Files to Create

```
app/(dashboard)/balance/
├── page.tsx                           ← Balance overview + withdrawal form
└── history/page.tsx                   ← Full transaction history (paginated)

app/api/payouts/
├── route.ts                           ← GET (list payouts) + POST (request payout)
├── [id]/route.ts                      ← GET single payout status
└── verify-email/route.ts              ← Verify PayPal email before first withdrawal

components/balance/
├── balance-overview.tsx               ← Cards: Available, Pending, Total Earned, Total Withdrawn
├── withdrawal-form.tsx                ← Amount input + PayPal email + submit
├── paypal-email-verification.tsx      ← Confirm PayPal email step (was missing from original plan)
├── transaction-table.tsx              ← Full transaction log table
└── payout-status-badge.tsx            ← Status indicator (pending, processing, completed, failed)

lib/paypal/
├── client.ts                          ← PayPal SDK client singleton
└── create-payout.ts                   ← PayPal Payouts API integration

app/api/webhooks/
└── paypal/route.ts                    ← PayPal webhook for payout status updates
```

---

## Implementation Details

### 1. Balance Overview Page

```
┌──────────────────────────────────────────────────┐
│  My Balance                                       │
├───────────┬───────────┬───────────┬──────────────┤
│ Available │ Pending   │ Total     │ Total        │
│ Balance   │ Balance   │ Earned    │ Withdrawn    │
│ $247.60   │ $34.00    │ $891.20   │ $609.60      │
├───────────┴───────────┴───────────┴──────────────┤
│                                                    │
│  Paid Users: 38                                    │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │  Withdraw to PayPal                          │  │
│  │  Amount: [$247.60        ] (min $10.00)      │  │
│  │  PayPal: [sarah@creator.com]  ✓ Verified     │  │
│  │  [Request Withdrawal]                        │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  Recent Transactions                [View All →]  │
│  ┌───────┬────────┬───────┬──────┬────────────┐  │
│  │ Date  │ User   │ Type  │ Amt  │ Status     │  │
│  ├───────┼────────┼───────┼──────┼────────────┤  │
│  │ Feb 1 │ john@  │ Sub   │+$6.80│ Completed  │  │
│  │ Jan 28│ —      │Payout │-$100 │ Completed  │  │
│  │ Jan 25│ jane@  │ Sub   │+$6.80│ Completed  │  │
│  └───────┴────────┴───────┴──────┴────────────┘  │
└──────────────────────────────────────────────────┘
```

**Balance calculations:**
- **Available Balance** = `User.balance` (already calculated by Segment 07 webhook)
- **Pending Balance** = Sum of transactions from last 7 days (Stripe holds funds briefly)
- **Total Earned** = Sum of all COMPLETED transactions where type = SUBSCRIPTION_PAYMENT (creator's share)
- **Total Withdrawn** = Sum of all COMPLETED payouts
- **Paid Users** = Distinct count of users with ACTIVE subscriptions across all creator's weblets

### 2. PayPal Email Verification (Client Requirement — Was Missing)

Before the first withdrawal, creators must verify their PayPal email:

1. Creator enters PayPal email address
2. System sends a verification code to that email (via Resend)
3. Creator enters the code
4. PayPal email is saved to `User.paypalEmail` and marked verified

```typescript
// app/api/payouts/verify-email/route.ts
export async function POST(req: Request) {
  const { email, code } = await req.json();
  const session = await auth();

  if (code) {
    // Verify the code
    const stored = await redis.get(`paypal-verify:${session.user.id}`);
    if (stored !== code) {
      return Response.json({ error: "Invalid code" }, { status: 400 });
    }
    // Save verified email
    await db.user.update({
      where: { id: session.user.id },
      data: { paypalEmail: email, paypalEmailVerified: true },
    });
    await redis.del(`paypal-verify:${session.user.id}`);
    return Response.json({ verified: true });
  }

  // Send verification code
  const verifyCode = Math.random().toString().slice(2, 8); // 6 digits
  await redis.set(`paypal-verify:${session.user.id}`, verifyCode, { ex: 600 }); // 10 min expiry
  await sendEmail(email, "Verify your PayPal email", `Your code: ${verifyCode}`);
  return Response.json({ sent: true });
}
```

**Database addition:**
```prisma
// Add to User model:
paypalEmailVerified Boolean @default(false)
```

### 3. Payout Request

```typescript
// app/api/payouts/route.ts — POST handler
export async function POST(req: Request) {
  const session = await auth();
  const { amount } = await req.json();
  const user = await db.user.findUnique({ where: { id: session.user.id } });

  // Validations
  if (!user.paypalEmail || !user.paypalEmailVerified) {
    return Response.json({ error: "Please verify your PayPal email first" }, { status: 400 });
  }
  if (amount < 10) {
    return Response.json({ error: "Minimum withdrawal is $10.00" }, { status: 400 });
  }
  if (Number(user.balance) < amount) {
    return Response.json({ error: "Insufficient balance" }, { status: 400 });
  }

  // Check for pending payouts (prevent double withdrawal)
  const pendingPayout = await db.payout.findFirst({
    where: { creatorId: user.id, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (pendingPayout) {
    return Response.json({ error: "You already have a pending withdrawal" }, { status: 400 });
  }

  // Create payout record
  const payout = await db.payout.create({
    data: {
      creatorId: user.id,
      amount,
      paypalEmail: user.paypalEmail,
      status: "PENDING",
    },
  });

  // Deduct from balance immediately
  await db.user.update({
    where: { id: user.id },
    data: { balance: { decrement: amount } },
  });

  // Send PayPal payout
  try {
    await sendPayPalPayout(payout);
    await db.payout.update({ where: { id: payout.id }, data: { status: "PROCESSING" } });
  } catch (error) {
    // Refund balance on failure
    await db.user.update({ where: { id: user.id }, data: { balance: { increment: amount } } });
    await db.payout.update({ where: { id: payout.id }, data: { status: "FAILED" } });
    return Response.json({ error: "PayPal payout failed. Balance restored." }, { status: 500 });
  }

  return Response.json({ payout });
}
```

### 4. PayPal Payouts API

```typescript
// lib/paypal/create-payout.ts
import paypal from "@paypal/payouts-sdk";

export async function sendPayPalPayout(payout: Payout) {
  const request = new paypal.payouts.PayoutsPostRequest();
  request.requestBody({
    sender_batch_header: {
      sender_batch_id: `webletgpt_${payout.id}`,
      email_subject: "Your WebletGPT earnings have arrived!",
      email_message: "Thank you for creating on WebletGPT.",
    },
    items: [{
      recipient_type: "EMAIL",
      amount: { value: payout.amount.toString(), currency: "USD" },
      receiver: payout.paypalEmail,
      note: `WebletGPT payout - ${payout.id}`,
      sender_item_id: payout.id,
    }],
  });

  return await paypalClient.execute(request);
}
```

### 5. PayPal Webhook (Payout Status Updates)

```typescript
// app/api/webhooks/paypal/route.ts
// Handle: PAYMENT.PAYOUTSBATCH.SUCCESS, PAYMENT.PAYOUTSBATCH.DENIED
export async function POST(req: Request) {
  const body = await req.json();
  // Verify webhook signature with PayPal

  const payoutId = body.resource.sender_batch_header.sender_batch_id.replace("webletgpt_", "");

  if (body.event_type === "PAYMENT.PAYOUTSBATCH.SUCCESS") {
    await db.payout.update({
      where: { id: payoutId },
      data: { status: "COMPLETED", processedAt: new Date() },
    });
  }

  if (body.event_type === "PAYMENT.PAYOUTSBATCH.DENIED") {
    const payout = await db.payout.findUnique({ where: { id: payoutId } });
    // Refund balance
    await db.user.update({
      where: { id: payout.creatorId },
      data: { balance: { increment: payout.amount } },
    });
    await db.payout.update({
      where: { id: payoutId },
      data: { status: "FAILED" },
    });
  }

  return Response.json({ received: true });
}
```

### 6. Transaction History

Full paginated table showing:
- Date
- User email (for subscription payments) or "—" (for payouts)
- Weblet name
- Type: "Subscription" / "Payout" / "Refund"
- Amount (positive for income, negative for payouts)
- Fee (platform fee deducted)
- Net (amount after fee)
- Status badge (pending, completed, failed)

Support CSV export for accounting.

---

## Acceptance Criteria

- [ ] Balance page shows: Available Balance, Pending Balance, Total Earned, Total Withdrawn
- [ ] Balance page shows Number of Paid Users across all weblets
- [ ] PayPal email verification flow works (enter email → get code → verify)
- [ ] Verified PayPal email saved to user profile with `paypalEmailVerified: true`
- [ ] Withdrawal request validates: minimum $10, sufficient balance, no pending payouts
- [ ] Withdrawal request deducts from balance immediately
- [ ] PayPal Payouts API called successfully (sandbox mode)
- [ ] PayPal webhook updates payout status to COMPLETED
- [ ] Failed PayPal payout restores creator's balance
- [ ] Transaction history table shows all payments and payouts
- [ ] Transaction table is paginated (20 per page)
- [ ] Transaction table supports CSV export
- [ ] Payout status badge shows correct state (pending → processing → completed)
- [ ] Creator cannot withdraw if PayPal email is not verified
- [ ] Creator cannot withdraw more than available balance
- [ ] Creator cannot have multiple pending payouts simultaneously

---

## Environment Variables to Add

```env
PAYPAL_CLIENT_ID=xxxxx
PAYPAL_CLIENT_SECRET=xxxxx
PAYPAL_MODE=sandbox          # "sandbox" or "live"
PAYPAL_WEBHOOK_ID=xxxxx
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PayPal Payouts API approval takes weeks | Start approval process on Day 1 of this segment. Use Sandbox for all development. |
| PayPal webhook verification | Use PayPal's official SDK webhook verification. Never trust unverified webhooks. |
| Race condition: double withdrawal | Check for pending payouts + use database transaction for balance deduction |
| Exchange rates (non-USD creators) | V1: USD only. Note in UI. V2: Add currency conversion. |
