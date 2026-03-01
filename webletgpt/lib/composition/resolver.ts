import { prisma } from "@/lib/prisma"

/**
 * Detect if adding childId as a child of parentId would create a cycle.
 *
 * Uses BFS to traverse the composition graph starting from childId.
 * If we encounter parentId in the traversal, it means adding this
 * edge would create a circular dependency.
 *
 * @param parentId - The weblet that would become the parent
 * @param childId - The weblet that would become the child
 * @returns true if a cycle would be created
 */
export async function detectCycle(parentId: string, childId: string): Promise<boolean> {
    // Direct self-reference
    if (parentId === childId) return true

    const visited = new Set<string>()
    const queue = [childId]

    while (queue.length > 0) {
        const current = queue.shift()!

        if (current === parentId) {
            return true // Cycle detected!
        }

        if (visited.has(current)) continue
        visited.add(current)

        // Get all children of the current weblet
        const children = await prisma.webletComposition.findMany({
            where: { parentWebletId: current },
            select: { childWebletId: true },
        })

        queue.push(...children.map((c) => c.childWebletId))
    }

    return false
}

/**
 * Get the depth of a weblet in the composition tree.
 * A weblet with no parents has depth 0.
 * Used to enforce the MAX_DEPTH limit.
 */
export async function getCompositionDepth(webletId: string): Promise<number> {
    let depth = 0
    const visited = new Set<string>()
    let currentIds = [webletId]

    while (currentIds.length > 0) {
        const parents = await prisma.webletComposition.findMany({
            where: { childWebletId: { in: currentIds } },
            select: { parentWebletId: true },
        })

        const parentIds = parents
            .map((p) => p.parentWebletId)
            .filter((id) => !visited.has(id))

        if (parentIds.length === 0) break

        depth++
        parentIds.forEach((id) => visited.add(id))
        currentIds = parentIds
    }

    return depth
}

/**
 * Resolve all child weblets for a parent weblet, with full
 * child weblet details needed for tool creation.
 */
export async function resolveCompositions(parentWebletId: string) {
    return prisma.webletComposition.findMany({
        where: { parentWebletId },
        include: {
            childWeblet: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    isActive: true,
                    capabilities: true,
                },
            },
        },
    })
}
