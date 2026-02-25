// lib/billing/cycle-reset.ts
import { prisma as db } from "@/lib/prisma";
import { addMonths } from "date-fns";

export async function resetBillingCycles() {
  const now = new Date();

  // Reset developer plans whose cycle has ended
  await db.developerPlan.updateMany({
    where: { billingCycleEnd: { lte: now } },
    data: {
      creditsUsed: 0,
      billingCycleStart: now,
      billingCycleEnd: addMonths(now, 1),
    },
  });

  // Reset user plans whose cycle has ended
  await db.userPlan.updateMany({
    where: { billingCycleEnd: { lte: now } },
    data: {
      creditsUsed: 0,
      workflowRunsUsed: 0,
      billingCycleStart: now,
      billingCycleEnd: addMonths(now, 1),
    },
  });
}
