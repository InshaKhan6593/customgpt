import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { detectCycle, getCompositionDepth } from "@/lib/composition/resolver"

const MAX_DEPTH = 3

// GET — List compositions for a weblet
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id: webletId } = await params

        const weblet = await prisma.weblet.findUnique({
            where: { id: webletId },
            select: { developerId: true },
        })

        if (!weblet || weblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const compositions = await prisma.webletComposition.findMany({
            where: { parentWebletId: webletId },
            include: {
                childWeblet: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        iconUrl: true,
                        category: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ compositions })
    } catch (error) {
        console.error("Compositions GET error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// POST — Add a child weblet composition
const addCompositionSchema = z.object({
    childWebletId: z.string().min(1, "Child weblet ID is required"),
    triggerCondition: z.string().nullable().optional(),
    passingContext: z.any().optional(),
})

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id: parentWebletId } = await params

        // Verify ownership of parent
        const parentWeblet = await prisma.weblet.findUnique({
            where: { id: parentWebletId },
            select: { developerId: true },
        })

        if (!parentWeblet || parentWeblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const body = await req.json()
        const result = addCompositionSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request", details: result.error }, { status: 400 })
        }

        const { childWebletId, triggerCondition, passingContext } = result.data

        // Verify child weblet exists and is active
        const childWeblet = await prisma.weblet.findUnique({
            where: { id: childWebletId },
            select: { id: true, isActive: true },
        })

        if (!childWeblet) {
            return NextResponse.json({ error: "Child weblet not found" }, { status: 404 })
        }

        if (!childWeblet.isActive) {
            return NextResponse.json({ error: "Child weblet is not active" }, { status: 400 })
        }

        // Check for duplicate
        const existing = await prisma.webletComposition.findUnique({
            where: {
                parentWebletId_childWebletId: {
                    parentWebletId,
                    childWebletId,
                },
            },
        })

        if (existing) {
            return NextResponse.json({ error: "This child weblet is already added" }, { status: 409 })
        }

        // Cycle detection
        const wouldCycle = await detectCycle(parentWebletId, childWebletId)
        if (wouldCycle) {
            return NextResponse.json(
                { error: "Adding this weblet would create a circular dependency" },
                { status: 400 }
            )
        }

        // Depth check
        const depth = await getCompositionDepth(parentWebletId)
        if (depth >= MAX_DEPTH) {
            return NextResponse.json(
                { error: `Maximum composition depth (${MAX_DEPTH}) reached` },
                { status: 400 }
            )
        }

        const composition = await prisma.webletComposition.create({
            data: {
                parentWebletId,
                childWebletId,
                triggerCondition: triggerCondition || null,
                passingContext: passingContext || null,
            },
            include: {
                childWeblet: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        description: true,
                        iconUrl: true,
                        category: true,
                    },
                },
            },
        })

        return NextResponse.json({ composition }, { status: 201 })
    } catch (error) {
        console.error("Compositions POST error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// DELETE — Remove a child composition
const deleteCompositionSchema = z.object({
    compositionId: z.string(),
})

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id: parentWebletId } = await params
        const body = await req.json()
        const result = deleteCompositionSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 })
        }

        const { compositionId } = result.data

        // Verify ownership
        const composition = await prisma.webletComposition.findFirst({
            where: { id: compositionId, parentWebletId },
            include: { parentWeblet: { select: { developerId: true } } },
        })

        if (!composition || composition.parentWeblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        await prisma.webletComposition.delete({
            where: { id: compositionId },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Compositions DELETE error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
