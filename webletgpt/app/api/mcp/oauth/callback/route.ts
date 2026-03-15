import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getOAuthProvider } from "@/lib/mcp/oauth-providers"
import { encryptToken } from "@/lib/mcp/encryption"

/**
 * GET /api/mcp/oauth/callback
 *
 * OAuth provider redirects here after user consent.
 * Exchanges authorization code for tokens using PKCE, stores encrypted tokens,
 * and returns an HTML page that signals the opener window via postMessage.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl
        const code = searchParams.get("code")
        const state = searchParams.get("state")
        const error = searchParams.get("error")

        if (error) {
            return htmlResponse(false, null, `OAuth error: ${error}`)
        }

        if (!code || !state) {
            return htmlResponse(false, null, "Missing code or state parameter")
        }

        // Validate session
        const session = await auth()
        if (!session?.user?.id) {
            return htmlResponse(false, null, "You must be logged in to complete OAuth")
        }

        // Look up and validate OAuth state
        const oauthState = await prisma.oAuthState.findUnique({
            where: { state },
        })

        if (!oauthState) {
            return htmlResponse(false, null, "Invalid or expired OAuth state")
        }

        if (oauthState.expiresAt < new Date()) {
            await prisma.oAuthState.delete({ where: { id: oauthState.id } })
            return htmlResponse(false, null, "OAuth session expired. Please try again.")
        }

        if (oauthState.userId !== session.user.id) {
            return htmlResponse(false, null, "OAuth state user mismatch")
        }

        // Look up the MCP server to get catalogId
        const server = await prisma.webletMCPServer.findUnique({
            where: { id: oauthState.serverId },
            select: { catalogId: true, label: true },
        })

        if (!server) {
            return htmlResponse(false, null, "MCP server not found")
        }

        const provider = getOAuthProvider(server.catalogId)
        if (!provider) {
            return htmlResponse(false, null, "No OAuth provider config found")
        }

        const clientId = process.env[provider.clientIdEnvVar]
        const clientSecret = process.env[provider.clientSecretEnvVar]
        if (!clientId || !clientSecret) {
            return htmlResponse(false, null, "OAuth credentials not configured")
        }

        // Delete state immediately after validation — prevents replay attacks
        // If token exchange fails the user restarts the flow (acceptable tradeoff)
        await prisma.oAuthState.delete({ where: { id: oauthState.id } })

        // Exchange authorization code for tokens
        const tokenRes = await fetch(provider.tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: oauthState.redirectUri,
                client_id: clientId,
                client_secret: clientSecret,
                code_verifier: oauthState.codeVerifier,
            }),
        })

        if (!tokenRes.ok) {
            const errText = await tokenRes.text()
            console.error("[MCP OAuth] Token exchange failed:", errText)
            return htmlResponse(false, null, "Failed to exchange authorization code")
        }

        const tokenData = await tokenRes.json()
        const accessToken = tokenData.access_token

        if (!accessToken) {
            return htmlResponse(false, null, "No access token received")
        }

        // Encrypt tokens
        const encAccess = encryptToken(accessToken)

        const createData: any = {
            userId: session.user.id,
            serverId: oauthState.serverId,
            tokenEnc: encAccess.encrypted,
            tokenIv: encAccess.iv,
            tokenType: "oauth",
            expiresAt: tokenData.expires_in
                ? new Date(Date.now() + tokenData.expires_in * 1000)
                : null,
            scope: tokenData.scope || provider.scopes.join(" "),
        }

        const updateData: any = { ...createData }
        delete updateData.userId
        delete updateData.serverId

        if (tokenData.refresh_token) {
            const encRefresh = encryptToken(tokenData.refresh_token)
            createData.refreshTokenEnc = encRefresh.encrypted
            createData.refreshTokenIv = encRefresh.iv
            updateData.refreshTokenEnc = encRefresh.encrypted
            updateData.refreshTokenIv = encRefresh.iv
        }

        // Upsert user token
        await prisma.userMCPToken.upsert({
            where: {
                userId_serverId: {
                    userId: session.user.id,
                    serverId: oauthState.serverId,
                },
            },
            create: createData,
            update: updateData,
        })

        return htmlResponse(true, oauthState.serverId, undefined, server.label)
    } catch (error) {
        console.error("[MCP OAuth] Callback error:", error)
        return htmlResponse(false, null, "An unexpected error occurred")
    }
}

function htmlResponse(
    success: boolean,
    serverId: string | null,
    errorMessage?: string,
    serverLabel?: string
) {
    const html = `<!DOCTYPE html>
<html>
<head><title>${success ? "Connected" : "Error"}</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
  .card { text-align: center; padding: 2rem; border-radius: 12px; border: 1px solid #27272a; background: #18181b; max-width: 360px; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h2 { margin: 0 0 8px; font-size: 18px; }
  p { margin: 0; color: #a1a1aa; font-size: 14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✓" : "✗"}</div>
    <h2>${success ? `Connected to ${serverLabel || "service"}` : "Connection Failed"}</h2>
    <p>${success ? "You can close this window." : (errorMessage || "Please try again.")}</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: "mcp-oauth-complete",
        success: ${success},
        serverId: ${serverId ? `"${serverId}"` : "null"},
        error: ${errorMessage ? `"${errorMessage}"` : "null"}
      }, window.location.origin);
    }
    setTimeout(() => window.close(), ${success ? 1500 : 5000});
  </script>
</body>
</html>`

    return new NextResponse(html, {
        headers: { "Content-Type": "text/html" },
    })
}
