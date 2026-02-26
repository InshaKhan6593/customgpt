import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { inngest } from "@/lib/inngest/client";

export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId: id } = await params;
    await requireRole("USER");
    const body = await req.json();
    const { action, feedback } = body; // action: 'approve' | 'reject'

    // Send the human-in-the-loop response back to Inngest to resume execution
    await inngest.send({
      name: "flow/hitl.response",
      data: {
        sessionId: id,
        action,
        feedback: feedback || ""
      }
    });

    return successResponse({ success: true });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
