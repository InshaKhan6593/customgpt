import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { z } from "zod"

const discoverSchema = z.object({
    serverId: z.string(),
    webletId: z.string(),
})

/**
 * POST — Discover tools from an MCP server.
 *
 * This triggers tool discovery by connecting to the MCP server,
 * fetching available tools, and caching them in the database.
 *
 * Note: Full MCP protocol discovery will be wired in lib/mcp/client.ts.
 * For now, this endpoint updates the cached tool definitions.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const result = discoverSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 })
        }

        const { serverId, webletId } = result.data

        // Verify ownership
        const server = await prisma.webletMCPServer.findFirst({
            where: { id: serverId, webletId },
            include: { weblet: { select: { developerId: true } } },
        })

        if (!server || server.weblet.developerId !== session.user.id) {
            return NextResponse.json({ error: "Not found" }, { status: 404 })
        }

        // Attempt MCP tool discovery
        // In production, this uses createMCPClient from @ai-sdk/mcp
        // For now, we do a best-effort discovery with a timeout
        try {
            const { discoverMCPTools } = await import("@/lib/mcp/discover")
            const tools = await discoverMCPTools(server.serverUrl, server.authToken)

            // Cache the discovered tools
            await prisma.webletMCPServer.update({
                where: { id: serverId },
                data: { tools: tools as any },
            })

            return NextResponse.json({ success: true, tools })
        } catch (discoverError: any) {
            console.error("MCP discovery failed:", discoverError)
            return NextResponse.json(
                { error: `Discovery failed: ${discoverError.message || "Server unreachable"}` },
                { status: 502 }
            )
        }
    } catch (error) {
        console.error("MCP discover error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
