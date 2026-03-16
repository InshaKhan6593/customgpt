import { prisma as db } from "@/lib/prisma";
import { DeveloperPlan, UserPlan } from "@prisma/client";

/**
 * Check if a user has enough credits to use a weblet.
 *
 * Accepts pre-fetched developerId to avoid re-querying the weblet table
 * (the route already has the weblet data from its initial fetch).
 */
export async function checkQuotas(
  userId: string,
  webletId: string,
  developerId?: string
): Promise<{
  allowed: boolean;
  reason?: string;
  userPlan?: UserPlan | null;
  devPlan?: DeveloperPlan | null;
  triggerReload?: boolean;
}> {
  // If developerId was passed, skip the weblet lookup entirely
  const devId = developerId ?? (await db.weblet.findUnique({
    where: { id: webletId },
    select: { developerId: true },
  }))?.developerId;

  if (!devId) {
    return { allowed: false, reason: "weblet_not_found" };
  }

  // Fetch user plan + developer plan in parallel (2 queries instead of 3)
  const [userPlan, devPlan] = await Promise.all([
    db.userPlan.findUnique({ where: { userId } }),
    db.developerPlan.findUnique({ where: { userId: devId } }),
  ]);

  // Check user credits
  const userCreditsIncluded = userPlan?.creditsIncluded ?? 100;
  const userCreditsUsed = userPlan?.creditsUsed ?? 0;

  if (userCreditsIncluded !== -1 && userCreditsUsed >= userCreditsIncluded) {
    if (!userPlan || userPlan.tier === 'FREE_USER') {
      return { allowed: false, reason: "user_credits_exceeded", userPlan, devPlan };
    }
  }

  // Check developer credits
  const devCreditsIncluded = devPlan?.creditsIncluded ?? 200;
  const devCreditsUsed = devPlan?.creditsUsed ?? 0;

  if (devCreditsUsed >= devCreditsIncluded) {
    if (devPlan?.autoReloadEnabled) {
      return { allowed: true, userPlan, devPlan, triggerReload: true };
    } else {
      return { allowed: false, reason: "developer_credits_exhausted", userPlan, devPlan };
    }
  }

  return { allowed: true, userPlan, devPlan };
}
