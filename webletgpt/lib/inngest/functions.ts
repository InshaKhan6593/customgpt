import { inngest } from "./client";
import { prisma as db } from "@/lib/prisma";
import { addMonths } from "date-fns";

export const resetBillingCycles = inngest.createFunction(
  { id: "reset-billing-cycles" },
  { cron: "0 0 * * *" }, // Midnight daily
  async ({ step }) => {
    const now = new Date();

    // Reset developer plans
    await step.run("reset-dev-plans", async () => {
      await db.developerPlan.updateMany({
        where: { billingCycleEnd: { lte: now } },
        data: {
          creditsUsed: 0,
          billingCycleStart: now,
          billingCycleEnd: addMonths(now, 1),
        },
      });
    });

    // Reset user plans
    await step.run("reset-user-plans", async () => {
      await db.userPlan.updateMany({
        where: { billingCycleEnd: { lte: now } },
        data: {
          creditsUsed: 0,
          workflowRunsUsed: 0,
          billingCycleStart: now,
          billingCycleEnd: addMonths(now, 1),
        },
      });
    });
    
    return { success: true, message: "Billing cycles reset successfully" };
  }
);
