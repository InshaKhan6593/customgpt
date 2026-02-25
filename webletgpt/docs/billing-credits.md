# WebletGPT Billing & Credit System

This document explains how credits are tracked, calculated, and deducted during normal chat usage and subscription purchases.

## 1. Credit Allocation

Credits are assigned when a user or developer purchases a subscription.

*   **Users:** Subscribing to a plan (e.g., Plus, Power) grants a fixed monthly pool of included credits (e.g., 1,000 for Plus). Free users get a small baseline (e.g., 100).
*   **Developers:** Upgrading a developer workspace tier grants a monthly pool of credits (e.g., 10,000 for Pro).

These allocations happen inside the Stripe Webhook (`lib/stripe/webhook-handlers.ts`), which listens for `checkout.session.completed` events and updates the `UserPlan` or `DeveloperPlan` tables.

## 2. Quota Checks (Before Chat)

When a user sends a message, `app/api/chat/route.ts` runs the `checkQuotas(userId, webletId)` function (found in `lib/billing/quota-check.ts`).

*   If the **User** is out of credits, their prompts are blocked.
*   If the **Developer** whose Weblet is being invoked is out of credits:
    *   If `autoReloadEnabled` is true, the chat is allowed. A background job triggers a Stripe charge to reload developer credits.
    *   If `autoReloadEnabled` is false, the Weblet is suspended and the chat is blocked.

## 3. Credit Deduction (After Chat)

After the LLM finishes streaming the response back to the user, the `onFinish` callback in `app/api/chat/route.ts` fires and calls `logUsage(...)`.

This background process calculates the final cost using `calculateCredits()` (found in `lib/billing/credit-calculator.ts`).

### Multipliers & Tool Costs

The base cost of a single message is **1 credit**. However, if the LLM triggers specialized tools, the cost multiplied.

| Feature / Tool       | Multiplier (Credits Used) |
| :------------------- | :----------------------- |
| Standard Chat text   | 1 credit                 |
| Knowledge Retrieval  | 2 credits (per search)   |
| Web Search (Tavily)  | 3 credits (per search)   |
| Code Interpreter     | 3 credits (per execution)|
| Image Gen (DALL-E)   | 5 credits (per image)    |

*Note: These multipliers are defined in the `CREDIT_MULTIPLIERS` constant in `lib/billing/credit-calculator.ts`.*

### Database Deductions

`logUsage` performs a database transaction:

1.  **UsageRecord Created:** A detailed log of the chat is written to `UsageRecord` (tracking `tokensIn`, `tokensOut`, exact tools used, and calculated `estimatedCost` & `creditsCharged`).
2.  **Developer Deduction:** The Developer's `creditsUsed` field is incremented.
3.  **User Deduction:** The User's `creditsUsed` field is incremented.

## 4. Overage Charges (Auto-Reload)

If an active Developer Weblet goes heavily viral and drains all its included monthly credits, the `logUsage` cycle eventually hits the ceiling.

Next time `checkQuotas` fires, if `autoReloadEnabled` is on, it invokes the logic in `lib/billing/overage.ts`. This immediately contacts Stripe to trigger an off-session `PaymentIntent` to buy a block of new credits (e.g., 2,000 credits for $10.00), keeping the Weblet online without interruption.

## 5. End of Month Reset

At the start of the next billing cycle, a Cron job (`app/api/cron/reset-billing/route.ts`) or an Inngest background job loops over all subscriptions whose `billingCycleEnd` date has passed.

It sets `creditsUsed = 0` and advances the `billingCycleStart/End` dates by 1 month, starting the process over.
