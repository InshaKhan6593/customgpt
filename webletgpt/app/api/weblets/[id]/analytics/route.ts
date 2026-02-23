import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("DEVELOPER");
    
    // Auth Check
    const weblet = await prisma.weblet.findUnique({ where: { id } });
    if (!weblet) return errorResponse("Weblet not found", 404);
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403);

    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get("eventType");
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    let whereClause: any = { webletId: id };
    
    if (eventType) {
      whereClause.eventType = eventType;
    }
    
    if (fromStr || toStr) {
      whereClause.createdAt = {};
      if (fromStr) whereClause.createdAt.gte = new Date(fromStr);
      if (toStr) whereClause.createdAt.lte = new Date(toStr);
    }

    const events = await prisma.analyticsEvent.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: 100 // Limit for this segment
    });

    return successResponse(events);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
