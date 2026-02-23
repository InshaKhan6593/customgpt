import { NextRequest } from "next/server"
import { requireRole } from "@/lib/utils/auth-guard"
import { successResponse, errorResponse } from "@/lib/utils/api-response"
import { prisma } from "@/lib/prisma"

// GET /api/dashboard/weblets/[id] — Detailed analytics for a specific weblet
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireRole("DEVELOPER")

    // Verify ownership
    const weblet = await prisma.weblet.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNum: "desc" },
          take: 5,
        },
        knowledgeFiles: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
    })

    if (!weblet) return errorResponse("Weblet not found", 404)
    if (weblet.developerId !== user.id) return errorResponse("Forbidden", 403)

    // Count stats separately
    const chatCount = await prisma.chatSession.count({
      where: { webletId: id },
    })
    const eventCount = await prisma.analyticsEvent.count({
      where: { webletId: id },
    })

    // Fetch analytics events with date range support
    const { searchParams } = new URL(req.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const dateFilter: any = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)

    const events = await prisma.analyticsEvent.findMany({
      where: {
        webletId: id,
        ...(from || to ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    // Group events by type
    const eventsByType: Record<string, number> = {}
    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1
    }

    return successResponse({
      weblet: {
        id: weblet.id,
        name: weblet.name,
        slug: weblet.slug,
        category: weblet.category,
        isActive: weblet.isActive,
        isPublic: weblet.isPublic,
        accessType: weblet.accessType,
        createdAt: weblet.createdAt,
        updatedAt: weblet.updatedAt,
      },
      stats: {
        totalChats: chatCount,
        totalEvents: eventCount,
        eventsByType,
      },
      recentVersions: weblet.versions,
      knowledgeFiles: weblet.knowledgeFiles,
      recentEvents: events.slice(0, 20),
    })
  } catch (err: any) {
    if (err.name === "AuthorizationError") {
      return errorResponse(err.message, err.message.includes("Not auth") ? 401 : 403)
    }
    return errorResponse("Internal server error", 500)
  }
}
