import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { CREDITS_BY_TIER } from "@/lib/billing/pricing";
import { prisma as db } from "@/lib/prisma";
import { UserTier, DevTier } from "@prisma/client";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const [userPlan, devPlan] = await Promise.all([
      db.userPlan.findUnique({ where: { userId } }),
      db.developerPlan.findUnique({ where: { userId } }),
    ]);

    return NextResponse.json({ userPlan, devPlan });
  } catch (error) {
    console.error("Failed to fetch billing plans:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { type, tier } = await req.json();

  if (!type || !tier) {
    return NextResponse.json({ error: "Missing type or tier" }, { status: 400 });
  }

  try {
    if (type === "user") {
      // In a real implementation this would create a Stripe checkout session
      // For now we mock the basic update if it's a valid enum
      const validTiers = Object.values(UserTier);
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: "Invalid user tier" }, { status: 400 });
      }
      
      const newLimits = CREDITS_BY_TIER[tier as keyof typeof CREDITS_BY_TIER] ?? 100;

      const plan = await db.userPlan.upsert({
        where: { userId },
        update: { tier, creditsIncluded: newLimits },
        create: {
          userId,
          tier,
          creditsIncluded: newLimits,
          billingCycleStart: new Date(),
          billingCycleEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        },
      });
      return NextResponse.json({ plan });

    } else if (type === "developer") {
      const validTiers = Object.values(DevTier);
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: "Invalid dev tier" }, { status: 400 });
      }

      const newLimits = CREDITS_BY_TIER[tier as keyof typeof CREDITS_BY_TIER] ?? 200;

      const plan = await db.developerPlan.upsert({
        where: { userId },
        update: { tier, creditsIncluded: newLimits },
        create: {
          userId,
          tier,
          creditsIncluded: newLimits,
          billingCycleStart: new Date(),
          billingCycleEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        },
      });
      return NextResponse.json({ plan });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update billing plan:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
