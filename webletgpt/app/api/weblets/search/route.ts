import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * GET /api/weblets/search?q=<query>&exclude=<webletId>&ids=<comma-separated-ids>
 *
 * Search for weblets that can be added as child compositions.
 * Excludes the current weblet and returns active, public weblets.
 * If `ids` is provided, returns weblets matching those IDs (for name resolution).
 */
export async function GET(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const idsParam = searchParams.get("ids")
        const limitParam = searchParams.get("limit")
        const parsedLimit = limitParam ? Number(limitParam) : 20
        const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 20

        // Bulk ID lookup mode — return {id, name} for given IDs
        if (idsParam) {
            const ids = idsParam.split(",").filter(Boolean)
            if (ids.length === 0) return NextResponse.json({ data: [] })

            const weblets = await prisma.weblet.findMany({
                where: { id: { in: ids } },
                select: { id: true, name: true, iconUrl: true },
            })
            return NextResponse.json({ data: weblets })
        }

        const query = searchParams.get("q") || ""
        const excludeId = searchParams.get("exclude") || ""

        const weblets = await prisma.weblet.findMany({
            where: {
                AND: [
                    { id: { not: excludeId } },
                    { isActive: true },
                    {
                        OR: [
                            { isPublic: true },
                            { developerId: session.user.id }, // Also show user's own weblets
                        ],
                    },
                    query
                        ? {
                            OR: [
                                { name: { contains: query, mode: "insensitive" } },
                                { description: { contains: query, mode: "insensitive" } },
                                { slug: { contains: query, mode: "insensitive" } },
                            ],
                        }
                        : {},
                ],
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                iconUrl: true,
                category: true,
                developer: {
                    select: { name: true },
                },
            },
            take,
            orderBy: { name: "asc" },
        })

        return NextResponse.json({ weblets })
    } catch (error) {
        console.error("Weblet search error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
