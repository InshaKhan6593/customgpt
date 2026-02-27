import Stripe from "stripe"
import { prisma } from "@/lib/prisma"
import { stripe } from "@/lib/stripe/client"
import { SubStatus, TxType, TxStatus } from "@prisma/client"
import { PLATFORM_FEE_RATE } from "@/lib/constants"

// ── Tier → credits mapping (mirrors the checkout route) ──
const CREDITS_BY_TIER: Record<string, number> = {
  STARTER: 200,
  PRO: 10_000,
  BUSINESS: 50_000,
  ENTERPRISE: -1,
  FREE_USER: 100,
  PLUS: 1_000,
  POWER: -1,
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const metadata = session.metadata;
  if (!metadata || !metadata.userId) return;

  const subscriptionId = session.subscription as string;
  const customAmount = session.amount_total ? session.amount_total / 100 : 0;
  const userId = metadata.userId;
  const tier = metadata.tier;
  const planType = metadata.planType;

  const now = new Date();
  const nextMonth = new Date(new Date().setMonth(now.getMonth() + 1));

  if (planType === "developer_plan") {
    // ── Developer Platform Plan Subscription (Upgrade / New) ──
    const creditsIncluded = CREDITS_BY_TIER[tier] ?? 10_000;
    await prisma.developerPlan.upsert({
      where: { userId },
      create: {
        userId,
        tier: tier as any,
        creditsIncluded,
        creditsUsed: 0,
        billingCycleStart: now,
        billingCycleEnd: nextMonth,
        stripeSubscriptionId: subscriptionId,
        autoReloadEnabled: true,
        autoReloadAmount: 2000,
        overageRate: 0.005,
      },
      update: {
        tier: tier as any,
        creditsIncluded,
        stripeSubscriptionId: subscriptionId,
        // Reset creditsUsed on upgrade so the full new quota is available
        creditsUsed: 0,
        billingCycleStart: now,
        billingCycleEnd: nextMonth,
      },
    });

    // Log the transaction
    const paymentId = (session.payment_intent as string) ?? subscriptionId;
    await prisma.transaction.upsert({
      where: { stripePaymentId: paymentId },
      create: {
        userId,
        amount: customAmount,
        type: "SUBSCRIPTION_PAYMENT",
        status: "COMPLETED",
        stripePaymentId: paymentId,
        metadata: { planType: "developer_plan", tier },
      },
      update: {},
    });

  } else if (planType === "user_plan") {
    // ── User Platform Plan Subscription (Upgrade / New) ──
    const creditsIncluded = CREDITS_BY_TIER[tier] ?? 1_000;
    await prisma.userPlan.upsert({
      where: { userId },
      create: {
        userId,
        tier: tier as any,
        creditsIncluded,
        creditsUsed: 0,
        workflowRunsIncluded: tier === "PLUS" ? 20 : tier === "POWER" ? 999_999 : 2,
        workflowRunsUsed: 0,
        billingCycleStart: now,
        billingCycleEnd: nextMonth,
        stripeSubscriptionId: subscriptionId,
      },
      update: {
        tier: tier as any,
        creditsIncluded,
        workflowRunsIncluded: tier === "PLUS" ? 20 : tier === "POWER" ? 999_999 : 2,
        stripeSubscriptionId: subscriptionId,
        creditsUsed: 0,
        billingCycleStart: now,
        billingCycleEnd: nextMonth,
      },
    });

    // Log the transaction
    const paymentId = (session.payment_intent as string) ?? subscriptionId;
    await prisma.transaction.upsert({
      where: { stripePaymentId: paymentId },
      create: {
        userId,
        amount: customAmount,
        type: "SUBSCRIPTION_PAYMENT",
        status: "COMPLETED",
        stripePaymentId: paymentId,
        metadata: { planType: "user_plan", tier },
      },
      update: {},
    });

  } else if (planType === "auto_reload") {
    // ── One-off Auto-Reload purchase ──
    const creditsPurchased = parseInt(metadata.creditsPurchased ?? "2000");
    await prisma.developerPlan.update({
      where: { userId },
      data: { creditsIncluded: { increment: creditsPurchased } },
    });

  } else if (metadata.webletId) {
    // ── Weblet Subscription (users subscribing to a paid weblet) ──
    await prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      create: {
        userId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscriptionId,
        status: "ACTIVE",
      },
      update: { status: "ACTIVE" },
    });

    if (session.payment_status === "paid" && customAmount > 0) {
      const paymentId = session.payment_intent as string;
      await prisma.transaction.upsert({
        where: { stripePaymentId: paymentId },
        create: {
          userId,
          amount: customAmount,
          type: "SUBSCRIPTION_PAYMENT",
          status: "COMPLETED",
          stripePaymentId: paymentId,
          metadata: { webletId: metadata.webletId },
        },
        update: {},
      });
    }
  }
}

export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const invoiceData: any = invoice;
  const subscriptionId = invoiceData.subscription as string;
  if (!subscriptionId) return;

  // Skip $0 invoices (free plan, trials, etc.)
  if (invoice.amount_paid === 0) return;

  const amountPaid = invoice.amount_paid / 100;
  const paymentId  = (invoiceData.payment_intent as string) || invoice.id;
  const lineItem: any = invoice.lines.data[0];
  const webletId = lineItem?.metadata?.webletId || lineItem?.price?.metadata?.webletId;

  // ── Weblet subscription renewal ──────────────────────────────────────────
  if (webletId) {
    const sub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (!sub) return;

    await prisma.transaction.upsert({
      where: { stripePaymentId: paymentId },
      create: {
        userId: sub.userId,
        amount: amountPaid,
        type: "SUBSCRIPTION_PAYMENT",
        status: "COMPLETED",
        stripePaymentId: paymentId,
        metadata: { webletId, reason: "renewal" },
      },
      update: {},
    });
    return;
  }

  // ── Platform plan invoice (new subscription, upgrade proration, renewal) ──
  // The subscription metadata carries userId + tier + planType from when we
  // created or last updated the subscription.
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const meta      = stripeSub.metadata as Record<string, string> | undefined;
  const userId    = meta?.userId;
  const tier      = meta?.tier;
  const planType  = meta?.planType;

  if (!userId || !tier || !planType) return;

  await prisma.transaction.upsert({
    where: { stripePaymentId: paymentId },
    create: {
      userId,
      amount: amountPaid,
      type: "SUBSCRIPTION_PAYMENT",
      status: "COMPLETED",
      stripePaymentId: paymentId,
      metadata: { planType, tier, reason: invoice.billing_reason ?? "payment" },
    },
    update: {},
  });

  // On renewal: reset creditsUsed so the user gets a fresh quota each cycle
  if (invoice.billing_reason === "subscription_cycle") {
    const creditsMap: Record<string, number> = {
      STARTER: 200, PRO: 10_000, BUSINESS: 50_000,
      FREE_USER: 100, PLUS: 1_000, POWER: -1,
    };
    const creditsIncluded = creditsMap[tier] ?? 1_000;

    if (planType === "developer_plan") {
      const now = new Date();
      await prisma.developerPlan.updateMany({
        where: { userId, stripeSubscriptionId: subscriptionId },
        data: {
          creditsUsed: 0,
          creditsIncluded,
          billingCycleStart: now,
          billingCycleEnd: new Date(new Date().setMonth(now.getMonth() + 1)),
        },
      });
    } else if (planType === "user_plan") {
      const now = new Date();
      await prisma.userPlan.updateMany({
        where: { userId, stripeSubscriptionId: subscriptionId },
        data: {
          creditsUsed: 0,
          creditsIncluded,
          billingCycleStart: now,
          billingCycleEnd: new Date(new Date().setMonth(now.getMonth() + 1)),
        },
      });
    }
  }
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const statusMap: Record<string, SubStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
  };
  const mappedStatus = statusMap[subscription.status] ?? "PAST_DUE";
  const subData: any = subscription;
  const currentPeriodEnd = subData.current_period_end
    ? new Date(subData.current_period_end * 1000)
    : null;

  // ── Weblet subscription ──────────────────────────────────────────────────
  try {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: mappedStatus, currentPeriodEnd },
    });
    return; // handled — exit early
  } catch {
    // Not a weblet sub — check if it's a platform plan below
  }

  // ── Platform plan (developer or user) ────────────────────────────────────
  // When the checkout route swaps a price via subscriptions.update(), Stripe
  // fires this event. The metadata on the subscription carries tier + planType
  // so we can keep our DB in sync as a reliable backup to the immediate update.
  const meta = subscription.metadata as Record<string, string> | undefined;
  const tier     = meta?.tier;
  const planType = meta?.planType;
  const userId   = meta?.userId;

  if (!userId || !tier || !planType) return;

  const creditsMap: Record<string, number> = {
    STARTER: 200, PRO: 10_000, BUSINESS: 50_000,
    FREE_USER: 100, PLUS: 1_000, POWER: -1,
  };
  const creditsIncluded = creditsMap[tier] ?? 1_000;

  if (planType === "developer_plan") {
    await prisma.developerPlan.updateMany({
      where: { userId, stripeSubscriptionId: subscription.id },
      data: { tier: tier as any, creditsIncluded },
    });
  } else if (planType === "user_plan") {
    const workflowRunsIncluded =
      tier === "PLUS" ? 20 : tier === "POWER" ? 999_999 : 2;
    await prisma.userPlan.updateMany({
      where: { userId, stripeSubscriptionId: subscription.id },
      data: { tier: tier as any, creditsIncluded, workflowRunsIncluded },
    });
  }
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const subData: any = subscription;
  const currentPeriodEnd = subData.current_period_end
    ? new Date(subData.current_period_end * 1000)
    : null;

  // For weblet subscriptions
  try {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: "CANCELED", currentPeriodEnd },
    });
  } catch { /* not a weblet sub */ }

  // For platform plan subscriptions — downgrade to free tier when cancelled
  const devPlan = await prisma.developerPlan.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (devPlan) {
    const now = new Date();
    await prisma.developerPlan.update({
      where: { id: devPlan.id },
      data: {
        tier: "STARTER",
        creditsIncluded: 200,
        stripeSubscriptionId: null,
        billingCycleStart: now,
        billingCycleEnd: new Date(new Date().setMonth(now.getMonth() + 1)),
      },
    });
    return;
  }

  const userPlan = await prisma.userPlan.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (userPlan) {
    const now = new Date();
    await prisma.userPlan.update({
      where: { id: userPlan.id },
      data: {
        tier: "FREE_USER",
        creditsIncluded: 100,
        workflowRunsIncluded: 2,
        stripeSubscriptionId: null,
        billingCycleStart: now,
        billingCycleEnd: new Date(new Date().setMonth(now.getMonth() + 1)),
      },
    });
  }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceData: any = invoice;
  const subscriptionId = invoiceData.subscription as string;
  if (!subscriptionId) return;

  try {
    await prisma.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: "PAST_DUE" },
    });
  } catch { /* not a weblet sub */ }

  // For developer platform plans — disable auto-reload if renewal fails
  const devPlan = await prisma.developerPlan.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (devPlan) {
    await prisma.developerPlan.update({
      where: { id: devPlan.id },
      data: { autoReloadEnabled: false },
    });
  }
}
