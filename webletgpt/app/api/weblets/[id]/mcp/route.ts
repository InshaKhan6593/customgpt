import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

// GET — List MCP servers for a weblet
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

        // Verify ownership
        const weblet = await prisma.weblet.findUnique({
            where: { id: webletId },
            select: { developerId: true },
        })

        if (!weblet || weblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const servers = await prisma.webletMCPServer.findMany({
            where: { webletId },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ servers })
    } catch (error) {
        console.error("MCP GET error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// POST — Add a new MCP server to a weblet
const addServerSchema = z.object({
    serverUrl: z.string().url("Valid URL required"),
    label: z.string().min(1, "Label is required"),
    description: z.string().nullable().optional(),
    authType: z.enum(["NONE", "API_KEY", "BEARER_TOKEN", "OAUTH"]).default("NONE"),
    authToken: z.string().nullable().optional(),
    catalogId: z.string().nullable().optional(),
    iconUrl: z.string().nullable().optional(),
    requiresUserAuth: z.boolean().default(false),
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

        const { id: webletId } = await params

        // Verify ownership
        const weblet = await prisma.weblet.findUnique({
            where: { id: webletId },
            select: { developerId: true },
        })

        if (!weblet || weblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const body = await req.json()
        const result = addServerSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request", details: result.error }, { status: 400 })
        }

        const { serverUrl, label, description, authType, authToken, catalogId, iconUrl, requiresUserAuth } = result.data

        // Check for duplicate
        const existing = await prisma.webletMCPServer.findUnique({
            where: { webletId_serverUrl: { webletId, serverUrl } },
        })

        if (existing) {
            return NextResponse.json({ error: "This MCP server is already connected" }, { status: 409 })
        }

        const server = await prisma.webletMCPServer.create({
            data: {
                webletId,
                serverUrl,
                label,
                description: description || null,
                authType: authType as any,
                authToken: authToken || null,
                catalogId: catalogId || null,
                iconUrl: iconUrl || null,
                requiresUserAuth,
                isActive: true,
            },
        })

        return NextResponse.json({ server }, { status: 201 })
    } catch (error) {
        console.error("MCP POST error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// PATCH — Update an MCP server (toggle active/inactive)
const patchServerSchema = z.object({
    serverId: z.string(),
    isActive: z.boolean().optional(),
})

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id: webletId } = await params
        const body = await req.json()
        const result = patchServerSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 })
        }

        const { serverId, isActive } = result.data

        // Verify ownership via weblet
        const server = await prisma.webletMCPServer.findFirst({
            where: { id: serverId, webletId },
            include: { weblet: { select: { developerId: true } } },
        })

        if (!server || server.weblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        const updated = await prisma.webletMCPServer.update({
            where: { id: serverId },
            data: {
                ...(isActive !== undefined && { isActive }),
            },
        })

        return NextResponse.json({ server: updated })
    } catch (error) {
        console.error("MCP PATCH error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// DELETE — Remove an MCP server from a weblet
const deleteServerSchema = z.object({
    serverId: z.string(),
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

        const { id: webletId } = await params
        const body = await req.json()
        const result = deleteServerSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 })
        }

        const { serverId } = result.data

        // Verify ownership
        const server = await prisma.webletMCPServer.findFirst({
            where: { id: serverId, webletId },
            include: { weblet: { select: { developerId: true } } },
        })

        if (!server || server.weblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        await prisma.webletMCPServer.delete({
            where: { id: serverId },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("MCP DELETE error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
