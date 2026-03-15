import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"
import { encryptToken } from "@/lib/mcp/encryption"

// POST — Save/update a user's token for an MCP server (PAT flow)
const saveTokenSchema = z.object({
    serverId: z.string().min(1),
    token: z.string().min(1, "Token is required"),
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
        const body = await req.json()
        const result = saveTokenSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request", details: result.error }, { status: 400 })
        }

        const { serverId, token } = result.data

        // Verify the server exists, belongs to this weblet, and requires user auth
        const server = await prisma.webletMCPServer.findFirst({
            where: {
                id: serverId,
                webletId,
                requiresUserAuth: true,
            },
        })

        if (!server) {
            return NextResponse.json(
                { error: "MCP server not found or does not require user authentication" },
                { status: 404 }
            )
        }

        // Encrypt the token
        const { encrypted, iv } = encryptToken(token)

        // Upsert: create or update the user's token for this server
        await prisma.userMCPToken.upsert({
            where: {
                userId_serverId: {
                    userId: session.user.id,
                    serverId,
                },
            },
            create: {
                userId: session.user.id,
                serverId,
                tokenEnc: encrypted,
                tokenIv: iv,
                tokenType: "pat",
            },
            update: {
                tokenEnc: encrypted,
                tokenIv: iv,
                tokenType: "pat",
            },
        })

        return NextResponse.json({ success: true, message: `Connected to ${server.label}` })
    } catch (error) {
        console.error("User MCP token POST error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

// DELETE — Remove a user's token for an MCP server
const deleteTokenSchema = z.object({
    serverId: z.string().min(1),
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

        const body = await req.json()
        const result = deleteTokenSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 })
        }

        const { serverId } = result.data

        await prisma.userMCPToken.deleteMany({
            where: {
                userId: session.user.id,
                serverId,
            },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("User MCP token DELETE error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
