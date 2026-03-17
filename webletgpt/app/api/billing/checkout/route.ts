import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { CREDITS_BY_TIER, FREE_TIERS, getWorkflowRunsForTier } from "@/lib/billing/pricing";
import { prisma as db } from "@/lib/prisma";
import { stripe } from "@/lib/stripe/client";

// Stripe Price IDs per tier (set in .env)
const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  PLUS:     process.env.STRIPE_USER_PLUS_PRICE_ID,
  POWER:    process.env.STRIPE_USER_POWER_PRICE_ID,
  PRO:      process.env.STRIPE_DEV_PRO_PRICE_ID,
  BUSINESS: process.env.STRIPE_DEV_BUSINESS_PRICE_ID,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tier, type } = await req.json();
  if (!tier || !type) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const userId    = session.user.id;
  const userEmail = session.user.email ?? "";
  const baseUrl   = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const planType  = type === "developer" ? "developer_plan" : "user_plan";

  try {
    // ── Look up existing plan record ──────────────────────────────────────────
    const existingPlan =
      type === "developer"
        ? await db.developerPlan.findUnique({ where: { userId } })
        : await db.userPlan.findUnique({ where: { userId } });

    const existingSubId = existingPlan?.stripeSubscriptionId ?? null;

    // ── PATH A: Active subscription exists → modify it (no new checkout) ──────
    if (existingSubId) {
      // Verify the subscription is still active in Stripe
      const stripeSub = await stripe.subscriptions.retrieve(existingSubId);
      const isActive  = ["active", "trialing"].includes(stripeSub.status);

      if (isActive) {
        // ── Downgrade to free → cancel at period end ────────────────────────
        if (FREE_TIERS.has(tier)) {
          await stripe.subscriptions.update(existingSubId, {
            cancel_at_period_end: true,
          });
          const endsAt = new Date((stripeSub as any).current_period_end * 1000).toISOString();
          return NextResponse.json({ downgraded: true, scheduledFor: "period_end", endsAt });
        }

        // ── Upgrade / downgrade between paid plans → swap price immediately ──
        const newPriceId = PLAN_PRICE_IDS[tier];
        if (!newPriceId) {
          return NextResponse.json(
            { error: `No Stripe Price ID configured for tier: ${tier}. Add it to your .env file.` },
            { status: 400 }
          );
        }

        const subItemId = stripeSub.items.data[0]?.id;
        if (!subItemId) {
          return NextResponse.json({ error: "Subscription item not found" }, { status: 400 });
        }

        // Swap the price — Stripe calculates and charges/credits the prorated difference
        await stripe.subscriptions.update(existingSubId, {
          items: [{ id: subItemId, price: newPriceId }],
          proration_behavior: "create_prorations",
          metadata: { userId, tier, planType },
        });

        // Immediately update our DB — webhook does this too but we don't want
        // the user sitting on stale data while waiting for it.
        const creditsIncluded = CREDITS_BY_TIER[tier as keyof typeof CREDITS_BY_TIER] ?? 1_000;
        if (type === "developer") {
          await db.developerPlan.update({
            where: { userId },
            data: { tier: tier as any, creditsIncluded, creditsUsed: 0 },
          });
        } else {
          await db.userPlan.update({
            where: { userId },
            data: {
              tier: tier as any,
              creditsIncluded,
               workflowRunsIncluded: getWorkflowRunsForTier(tier),
              creditsUsed: 0,
            },
          });
        }

        return NextResponse.json({ upgraded: true });
      }
      // Sub exists in DB but is cancelled/expired in Stripe — fall through
      // to create a fresh checkout session.
    }

    // ── PATH B: No active subscription → Stripe Checkout (first-time) ────────
    if (FREE_TIERS.has(tier)) {
      // Selecting free when no paid sub exists — nothing to do
      return NextResponse.json({ upgraded: true });
    }

    const priceId = PLAN_PRICE_IDS[tier];
    if (!priceId) {
      return NextResponse.json(
        { error: `No Stripe Price ID configured for tier: ${tier}. Add it to your .env file.` },
        { status: 400 }
      );
    }

    // Find or create Stripe Customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId  = customers.data[0]?.id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: userEmail, metadata: { userId } });
      customerId = customer.id;
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&tier=${tier}&type=${type}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/dashboard/billing?cancelled=true`,
      metadata: {
        userId,
        tier,
        type,
        planType,
        credits: String(CREDITS_BY_TIER[tier as keyof typeof CREDITS_BY_TIER] ?? 1_000),
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
          planType,
          credits: String(CREDITS_BY_TIER[tier as keyof typeof CREDITS_BY_TIER] ?? 1_000),
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("billing/checkout error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
