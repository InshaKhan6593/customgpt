import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma as db } from "@/lib/prisma";
import { stripe } from "@/lib/stripe/client";

// Map plan tiers to Stripe Price IDs (from env vars)
const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  // User plans
  PLUS: process.env.STRIPE_USER_PLUS_PRICE_ID,
  POWER: process.env.STRIPE_USER_POWER_PRICE_ID,
  // Developer plans
  PRO: process.env.STRIPE_DEV_PRO_PRICE_ID,
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

  const priceId = PLAN_PRICE_IDS[tier];
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe Price ID configured for tier: ${tier}. Add it to your .env file.` },
      { status: 400 }
    );
  }

  const CREDITS_BY_TIER: Record<string, string> = {
    // User
    PLUS: "1000",
    POWER: "-1",  // unlimited
    // Developer
    PRO: "10000",
    BUSINESS: "50000",
  };

  try {
    const userId = session.user.id;
    const userEmail = session.user.email ?? "";
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Find or create Stripe Customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId = customers.data[0]?.id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;
    }

    // planType must match what webhook-handlers.ts checks
    const planType = type === "developer" ? "developer_plan" : "user_plan";

    // Create a real Stripe Checkout Session (sandbox)
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard/billing?success=true&tier=${tier}&type=${type}`,
      cancel_url: `${baseUrl}/dashboard/billing?cancelled=true`,
      metadata: {
        userId,
        tier,
        type,
        planType,                            // ← webhook handler key
        credits: CREDITS_BY_TIER[tier] ?? "1000",  // ← webhook handler reads this
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
          planType,
          credits: CREDITS_BY_TIER[tier] ?? "1000",
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error: any) {
    console.error("Failed to create Stripe checkout session:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

