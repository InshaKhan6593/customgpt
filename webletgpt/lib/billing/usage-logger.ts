import { prisma as db } from "@/lib/prisma";
import { UsageSource, Prisma } from "@prisma/client";
import { calculateCredits } from "./credit-calculator";
import { calculateCost } from "./cost-calculator";

export async function logUsage(params: {
  userId: string;
  webletId: string;
  developerId: string;
  sessionId?: string | null;
  workflowId?: string | null;
  tokensIn: number;
  tokensOut: number;
  modelId: string;
  toolCalls?: Record<string, number> | null;
  source: UsageSource;
  parentRecordId?: string;
}) {
  const cost = calculateCost(params.modelId, params.tokensIn, params.tokensOut, params.toolCalls);
  const credits = calculateCredits(params.toolCalls);

  await db.$transaction(async (tx) => {
    // 1. Log the usage record
    await tx.usageRecord.create({
      data: {
        userId: params.userId,
        webletId: params.webletId,
        developerId: params.developerId,
        sessionId: params.sessionId,
        workflowId: params.workflowId,
        tokensIn: params.tokensIn,
        tokensOut: params.tokensOut,
        modelId: params.modelId,
        toolCalls: (params.toolCalls ? params.toolCalls : {}) as Prisma.JsonObject,
        creditsCharged: credits,
        estimatedCost: new Prisma.Decimal(cost),
        source: params.source,
        parentRecordId: params.parentRecordId,
      }
    });

    // 2. Decrement developer credits (increment usage)
    const devPlan = await tx.developerPlan.findUnique({ where: { userId: params.developerId } });
    if (devPlan) {
      await tx.developerPlan.update({
        where: { userId: params.developerId },
        data: { creditsUsed: { increment: credits } },
      });
    }

    // 3. Decrement user credits (only for non-composability sources)
    if (params.source !== "COMPOSABILITY") {
      const userPlan = await tx.userPlan.findUnique({ where: { userId: params.userId } });
      if (userPlan) {
        await tx.userPlan.update({
          where: { userId: params.userId },
          data: { creditsUsed: { increment: credits } },
        });
      }
    }
  });
}
