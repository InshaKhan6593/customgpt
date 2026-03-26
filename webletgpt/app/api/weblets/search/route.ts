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
        const exclude = (searchParams.get("exclude") || "").trim()

        const excludeFilter = exclude
            ? {
                NOT: {
                    OR: [
                        { id: exclude },
                        { slug: exclude },
                    ],
                },
            }
            : null

        const weblets = await prisma.weblet.findMany({
            where: {
                AND: [
                    ...(excludeFilter ? [excludeFilter] : []),
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
                developerId: true,
                developer: {
                    select: { name: true },
                },
            },
            take,
            orderBy: { name: "asc" },
        })

        let blockedByCycle = new Set<string>()

        if (exclude) {
            const parentWeblet = await prisma.weblet.findFirst({
                where: {
                    OR: [{ id: exclude }, { slug: exclude }],
                },
                select: { id: true },
            })

            if (parentWeblet) {
                blockedByCycle.add(parentWeblet.id)

                const visited = new Set<string>([parentWeblet.id])
                const queue = [parentWeblet.id]

                while (queue.length > 0) {
                    const batch = queue.splice(0, 100)
                    const directParents = await prisma.webletComposition.findMany({
                        where: { childWebletId: { in: batch } },
                        select: { parentWebletId: true },
                    })

                    for (const relation of directParents) {
                        if (!visited.has(relation.parentWebletId)) {
                            visited.add(relation.parentWebletId)
                            blockedByCycle.add(relation.parentWebletId)
                            queue.push(relation.parentWebletId)
                        }
                    }
                }
            }
        }

        const enrichedWeblets = weblets.map((weblet) => {
            const isSelectable = !blockedByCycle.has(weblet.id)
            const isOwnedByCurrentUser = weblet.developerId === session.user.id

            return {
                ...weblet,
                isOwnedByCurrentUser,
                isSelectable,
                disabledReason: isSelectable ? null : "Would create circular dependency",
            }
        })

        return NextResponse.json({ weblets: enrichedWeblets })
    } catch (error) {
        console.error("Weblet search error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
