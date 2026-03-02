import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("USER");
    
    const flow = await prisma.userFlow.findUnique({ where: { id } });
    if (!flow) return errorResponse("Flow not found", 404);
    if (flow.userId !== user.id) return errorResponse("Forbidden", 403);

    const steps = flow.steps as any[];
    if (!steps || steps.length === 0) {
      return errorResponse("Cannot execute a flow with no steps. Add steps in the builder first.", 400);
    }

    // HYBRID mode requires a master agent
    if (flow.mode === "HYBRID" && !flow.masterWebletId) {
      return errorResponse("Hybrid flows require a master agent. Configure one in the builder.", 400);
    }

    // Check workflow run quota
    const userPlan = await prisma.userPlan.findUnique({ where: { userId: user.id } });
    if (userPlan) {
      const limit = userPlan.workflowRunsIncluded;
      // -1 means unlimited
      if (limit !== -1 && userPlan.workflowRunsUsed >= limit) {
        return errorResponse(
          `Workflow run quota exceeded. You have used ${userPlan.workflowRunsUsed}/${limit} runs this billing cycle. Upgrade your plan for more.`,
          402
        );
      }

      // Increment usage
      await prisma.userPlan.update({
        where: { userId: user.id },
        data: { workflowRunsUsed: { increment: 1 } },
      });
    }

    const body = await req.json();
    const { initialInput } = body;

    // Use the flow's defaultPrompt as fallback when no initialInput is provided
    const resolvedInput = (initialInput && initialInput.trim()) ? initialInput : ((flow as any).defaultPrompt || "");

    if (!resolvedInput.trim()) {
      return errorResponse("No prompt provided. Set a default prompt in the flow builder or provide an initialInput.", 400);
    }

    const sessionId = randomUUID();

    // Trigger background execution (pass userId for credit enforcement)
    await inngest.send({
      name: "flow/execute",
      data: {
        flowId: id,
        sessionId,
        userId: user.id,
        initialInput: resolvedInput
      }
    });

    return successResponse({ sessionId }, 202);
  } catch (err: any) {
    console.error("Execute flow error:", err);
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
