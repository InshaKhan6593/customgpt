import { NextRequest } from "next/server"
import { requireRole } from "@/lib/utils/auth-guard"
import { successResponse, errorResponse } from "@/lib/utils/api-response"
import { prisma } from "@/lib/prisma"

// GET /api/dashboard/overview — Aggregate stats across developer's weblets
export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("DEVELOPER")

    // Get all weblets owned by this developer
    const weblets = await prisma.weblet.findMany({
      where: { developerId: user.id },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        isPublic: true,
        category: true,
        _count: {
          select: {
            chatSessions: true,
            knowledgeFiles: true,
            versions: true,
          },
        },
      },
    })

    // Aggregate analytics events across all weblets
    const webletIds = weblets.map((w) => w.id)

    const totalChats = await prisma.chatSession.count({
      where: { webletId: { in: webletIds } },
    })

    const totalEvents = await prisma.analyticsEvent.count({
      where: { webletId: { in: webletIds } },
    })

    // Get average rating from analytics events of type 'rating_given'
    const ratingEvents = await prisma.analyticsEvent.findMany({
      where: {
        webletId: { in: webletIds },
        eventType: "rating_given",
      },
      select: { eventData: true },
    })

    let avgRating = 0
    if (ratingEvents.length > 0) {
      const ratings = ratingEvents
        .map((e) => (e.eventData as any)?.rating)
        .filter((r): r is number => typeof r === "number")
      avgRating = ratings.length > 0
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length
        : 0
    }

    return successResponse({
      totalWeblets: weblets.length,
      activeWeblets: weblets.filter((w) => w.isActive).length,
      publicWeblets: weblets.filter((w) => w.isPublic).length,
      totalChats,
      totalEvents,
      avgRating: Math.round(avgRating * 100) / 100,
      weblets: weblets.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        isActive: w.isActive,
        isPublic: w.isPublic,
        category: w.category,
        chatCount: w._count.chatSessions,
        knowledgeFileCount: w._count.knowledgeFiles,
        versionCount: w._count.versions,
      })),
    })
  } catch (err: any) {
    if (err.name === "AuthorizationError") {
      return errorResponse(err.message, err.message.includes("Not auth") ? 401 : 403)
    }
    return errorResponse("Internal server error", 500)
  }
}
