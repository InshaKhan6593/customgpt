import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOAuthProvider } from "@/lib/mcp/oauth-providers"
import crypto from "crypto"

/**
 * POST /api/mcp/oauth/authorize
 *
 * Generates an OAuth 2.1 authorization URL with PKCE.
 * The frontend opens this URL in a popup for the user to consent.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { serverId, webletId } = await req.json()
        if (!serverId || !webletId) {
            return NextResponse.json({ error: "serverId and webletId are required" }, { status: 400 })
        }

        // Look up the MCP server to get its catalogId
        const server = await prisma.webletMCPServer.findUnique({
            where: { id: serverId },
            select: { catalogId: true, label: true, webletId: true },
        })

        if (!server) {
            return NextResponse.json({ error: "MCP server not found" }, { status: 404 })
        }

        if (server.webletId !== webletId) {
            return NextResponse.json({ error: "Server does not belong to this weblet" }, { status: 403 })
        }

        const provider = getOAuthProvider(server.catalogId)
        if (!provider) {
            return NextResponse.json(
                { error: `No OAuth provider configured for ${server.label}` },
                { status: 400 }
            )
        }

        const clientId = process.env[provider.clientIdEnvVar]
        if (!clientId) {
            return NextResponse.json(
                { error: `OAuth not configured for ${server.label}. Contact platform admin.` },
                { status: 500 }
            )
        }

        // Generate PKCE: code_verifier (43-128 chars) + code_challenge (S256)
        const codeVerifier = crypto.randomBytes(32).toString("base64url")
        const codeChallenge = crypto
            .createHash("sha256")
            .update(codeVerifier)
            .digest("base64url")

        // Generate random state for CSRF protection
        const state = crypto.randomBytes(32).toString("hex")

        // Build redirect URI
        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const redirectUri = `${baseUrl}/api/mcp/oauth/callback`

        // Store OAuth state in DB (10-minute TTL)
        await prisma.oAuthState.create({
            data: {
                state,
                codeVerifier,
                userId: session.user.id,
                serverId,
                webletId,
                redirectUri,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        // Build authorization URL
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: provider.scopes.join(" "),
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            ...provider.extraAuthParams,
        })

        const authorizationUrl = `${provider.authorizationUrl}?${params.toString()}`

        return NextResponse.json({ authorizationUrl })
    } catch (error) {
        console.error("[MCP OAuth] Authorize error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
