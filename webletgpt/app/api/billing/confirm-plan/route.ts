import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe/client";
import { handleCheckoutSessionCompleted } from "@/lib/stripe/webhook-handlers";

/**
 * POST /api/billing/confirm-plan
 *
 * Called client-side after Stripe redirects back with ?success=true.
 * Retrieves the checkout session from Stripe and immediately applies the plan
 * update — acting as a reliable backup in case the webhook arrives late or
 * fails (e.g. in local dev without the Stripe CLI running).
 *
 * The webhook handler uses upsert so running it twice is safe.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    // Security: only process sessions that belong to this user
    if (checkoutSession.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (checkoutSession.payment_status === "paid") {
      await handleCheckoutSessionCompleted(checkoutSession);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("confirm-plan error:", error);
    return NextResponse.json({ error: "Failed to confirm plan" }, { status: 500 });
  }
}
