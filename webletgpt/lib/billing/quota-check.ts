import { prisma as db } from "@/lib/prisma";
import { DeveloperPlan, UserPlan } from "@prisma/client";

export async function checkQuotas(userId: string, webletId: string): Promise<{
  allowed: boolean;
  reason?: string;
  userPlan?: UserPlan | null;
  devPlan?: DeveloperPlan | null;
  triggerReload?: boolean;
}> {
  const [userPlan, weblet] = await Promise.all([
    db.userPlan.findUnique({ where: { userId } }),
    db.weblet.findUnique({ where: { id: webletId } }),
  ]);

  if (!weblet) {
    return { allowed: false, reason: "weblet_not_found" };
  }

  const devPlan = await db.developerPlan.findUnique({
    where: { userId: weblet.developerId },
  });

  // Check user credits (hard cap for free users, soft cap for paid)
  // Assuming a free tier if userPlan doesn't exist
  const userCreditsIncluded = userPlan?.creditsIncluded ?? 100;
  const userCreditsUsed = userPlan?.creditsUsed ?? 0;
  
  if (userCreditsIncluded !== -1 && userCreditsUsed >= userCreditsIncluded) {
    if (!userPlan || userPlan.tier === 'FREE_USER') {
      return { allowed: false, reason: "user_credits_exceeded", userPlan, devPlan };
    }
    // Paid users: could flag overage here, but allow for now
  }

  // Check developer credits
  const devCreditsIncluded = devPlan?.creditsIncluded ?? 200; // Starter gets 200 by default
  const devCreditsUsed = devPlan?.creditsUsed ?? 0;

  if (devCreditsUsed >= devCreditsIncluded) {
    if (devPlan?.autoReloadEnabled) {
      // Allow the call, the background system will trigger Stripe auto-reload charge
      return { allowed: true, userPlan, devPlan, triggerReload: true };
    } else {
      // Developer has 0 credits, auto-reload failed or is off -> suspend weblet
      return { allowed: false, reason: "developer_credits_exhausted", userPlan, devPlan };
    }
  }

  return { allowed: true, userPlan, devPlan };
}
