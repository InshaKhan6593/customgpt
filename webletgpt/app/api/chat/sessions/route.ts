import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { errorResponse, paginatedResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("USER");
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const webletId = searchParams.get("webletId");
    const where: any = { userId: user.id };
    if (webletId) where.webletId = webletId;

    const [sessions, total] = await Promise.all([
      prisma.chatSession.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        include: {
          weblet: { select: { id: true, name: true, slug: true, iconUrl: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.chatSession.count({ where }),
    ]);

    const formatted = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
      weblet: s.weblet,
      messageCount: s._count.messages,
      lastMessage: s.messages[0] || null,
    }));

    return paginatedResponse(formatted, total, page, limit);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    return errorResponse("Internal server error", 500);
  }
}
