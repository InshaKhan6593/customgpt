import { NextRequest } from "next/server";
import { requireRole } from "@/lib/utils/auth-guard";
import { errorResponse, successResponse } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireRole("USER");

    // Fetch weblets and check if lazy migration is needed in parallel
    let [userWeblets, uwCount] = await Promise.all([
      prisma.userWeblet.findMany({
        where: { userId: user.id },
        orderBy: { addedAt: "desc" },
        include: {
          weblet: {
            select: {
              id: true,
              name: true,
              slug: true,
              iconUrl: true,
              conversationStarters: true,
            },
          },
        },
      }),
      prisma.userWeblet.count({ where: { userId: user.id } }),
    ]);

    // Lazy migration: if user has no UserWeblet records but has sessions, backfill
    if (uwCount === 0) {
      const distinctWeblets = await prisma.chatSession.findMany({
        where: { userId: user.id },
        distinct: ["webletId"],
        select: { webletId: true },
      });
      if (distinctWeblets.length > 0) {
        await prisma.userWeblet.createMany({
          data: distinctWeblets.map((s: { webletId: string }) => ({
            userId: user.id,
            webletId: s.webletId,
          })),
          skipDuplicates: true,
        });
        // Re-fetch after migration
        userWeblets = await prisma.userWeblet.findMany({
          where: { userId: user.id },
          orderBy: { addedAt: "desc" },
          include: {
            weblet: {
              select: { id: true, name: true, slug: true, iconUrl: true, conversationStarters: true },
            },
          },
        });
      }
    }

    const webletIds = userWeblets.map((uw: { weblet: { id: string } }) => uw.weblet.id);

    // Fetch only the 5 most recent sessions per weblet — limit total to avoid huge queries
    const sessions = webletIds.length > 0
      ? await prisma.chatSession.findMany({
          where: { userId: user.id, webletId: { in: webletIds } },
          orderBy: { updatedAt: "desc" },
          take: webletIds.length * 5, // max 5 per weblet
          select: {
            id: true,
            title: true,
            webletId: true,
            updatedAt: true,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, role: true, createdAt: true },
            },
            _count: { select: { messages: true } },
          },
        })
      : [];

    // Group sessions by webletId (max 5 per weblet)
    const sessionsByWeblet: Record<string, typeof sessions> = {};
    for (const s of sessions) {
      if (!sessionsByWeblet[s.webletId]) sessionsByWeblet[s.webletId] = [];
      if (sessionsByWeblet[s.webletId].length < 5) {
        sessionsByWeblet[s.webletId].push(s);
      }
    }

    const data = userWeblets.map((uw: any) => ({
      id: uw.id,
      addedAt: uw.addedAt,
      weblet: uw.weblet,
      sessions: (sessionsByWeblet[uw.weblet.id] || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        updatedAt: s.updatedAt,
        messageCount: s._count.messages,
        lastMessage: s.messages[0] || null,
      })),
    }));

    return successResponse(data);
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    console.error("[user-weblets GET]", err);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("USER");
    const body = await req.json();
    const { webletId } = body;

    if (!webletId) return errorResponse("webletId is required", 400);

    // Verify weblet exists and is public/active
    const weblet = await prisma.weblet.findUnique({
      where: { id: webletId },
      select: { id: true, isActive: true, isPublic: true, name: true, slug: true, iconUrl: true },
    });

    if (!weblet) return errorResponse("Weblet not found", 404);

    const userWeblet = await prisma.userWeblet.upsert({
      where: { userId_webletId: { userId: user.id, webletId } },
      create: { userId: user.id, webletId },
      update: {},
    });

    return successResponse({
      id: userWeblet.id,
      addedAt: userWeblet.addedAt,
      weblet: { id: weblet.id, name: weblet.name, slug: weblet.slug, iconUrl: weblet.iconUrl },
      sessions: [],
    });
  } catch (err: any) {
    if (err.name === "AuthorizationError") return errorResponse(err.message, 403);
    console.error("[user-weblets POST]", err);
    return errorResponse("Internal server error", 500);
  }
}
