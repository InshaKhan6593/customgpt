import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("USER");
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          weblet: { select: { name: true, slug: true } },
          _count: { select: { messages: true } }
        }
      }),
      prisma.chatSession.count({ where: { userId: user.id } })
    ]);

    return paginatedResponse(sessions, total, page, limit);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
