import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("USER");

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(subscriptions);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}

// POST /api/subscriptions — Create a subscription (Stripe Checkout — Segment 07)
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("USER");

    // Segment 07 will implement:
    // 1. Validate webletId
    // 2. Check weblet's accessType and pricing
    // 3. Create Stripe Checkout session
    // 4. Return checkout URL for redirect

    return errorResponse(
      "Subscription creation not yet implemented. Coming in Segment 07.",
      501
    );
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
