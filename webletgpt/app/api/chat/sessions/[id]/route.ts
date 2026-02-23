import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("USER");
    
    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        weblet: { select: { name: true, slug: true, developerId: true } },
        messages: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!session) return errorResponse("Chat session not found", 404);

    // Only the user who created it, or the developer investigating logs, can view it (simplified for Segment 3)
    if (session.userId !== user.id && user.role !== "ADMIN") {
      return errorResponse("Forbidden", 403);
    }

    return successResponse(session);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
