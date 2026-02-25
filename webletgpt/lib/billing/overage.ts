// lib/billing/overage.ts
// Called when a developer's credits hit 0 and autoReloadEnabled is true.
// Charges the developer's stored Stripe payment method and adds credits.

import { prisma as db } from "@/lib/prisma";
import { stripe } from "@/lib/stripe/client";

export async function processDeveloperOverage(developerId: string): Promise<boolean> {
  const plan = await db.developerPlan.findUnique({
    where: { userId: developerId },
    include: { user: { select: { email: true } } },
  });

  if (!plan || !plan.autoReloadEnabled) return false;

  const reloadCredits = plan.autoReloadAmount;                       // e.g. 2000
  const reloadCostUsd = Number(plan.overageRate) * reloadCredits;    // e.g. $10.00
  const reloadCostCents = Math.round(reloadCostUsd * 100);           // e.g. 1000

  try {
    // 1. Find the Stripe customer for this developer
    const customers = await stripe.customers.list({
      email: plan.user.email ?? "",
      limit: 1,
    });
    const customerId = customers.data[0]?.id;

    if (!customerId) {
      console.error(`[Overage] No Stripe customer found for developer ${developerId}`);
      await db.developerPlan.update({
        where: { id: plan.id },
        data: { autoReloadEnabled: false },
      });
      return false;
    }

    // 2. Get the customer's default payment method
    const customer = await stripe.customers.retrieve(customerId) as any;
    const paymentMethodId =
      customer.invoice_settings?.default_payment_method ||
      customer.default_source;

    if (!paymentMethodId) {
      console.error(`[Overage] No payment method on file for developer ${developerId}`);
      await db.developerPlan.update({
        where: { id: plan.id },
        data: { autoReloadEnabled: false },
      });
      return false;
    }

    // 3. Create a one-off PaymentIntent for the reload amount
    const paymentIntent = await stripe.paymentIntents.create({
      amount: reloadCostCents,
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId as string,
      confirm: true,
      off_session: true, // card is not present — saved payment method
      description: `WebletGPT auto-reload: ${reloadCredits.toLocaleString()} credits`,
      metadata: {
        userId: developerId,
        planType: "auto_reload",
        creditsPurchased: String(reloadCredits),
      },
    });

    if (paymentIntent.status !== "succeeded") {
      throw new Error(`PaymentIntent status: ${paymentIntent.status}`);
    }

    // 4. Charge succeeded — add credits and log the transaction
    await db.$transaction(async (tx) => {
      await tx.developerPlan.update({
        where: { id: plan.id },
        data: {
          creditsIncluded: { increment: reloadCredits },
        },
      });

      await tx.transaction.create({
        data: {
          userId: developerId,
          amount: reloadCostUsd,
          currency: "USD",
          type: "SUBSCRIPTION_PAYMENT",
          status: "COMPLETED",
          stripePaymentId: paymentIntent.id,
          metadata: {
            reason: "auto_reload",
            creditsPurchased: reloadCredits,
          },
        },
      });
    });

    return true;
  } catch (error: any) {
    console.error(`[Overage] Auto-reload failed for developer ${developerId}:`, error.message);

    // Disable auto-reload so we don't keep retrying a declining card
    await db.developerPlan.update({
      where: { id: plan.id },
      data: { autoReloadEnabled: false },
    });

    return false;
  }
}
