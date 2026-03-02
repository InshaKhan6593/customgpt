import { createMCPClient } from "@ai-sdk/mcp"
import { decryptToken } from "./encryption"

type MCPServerInput = {
    id: string
    serverUrl: string
    label: string
    authToken?: string | null
    requiresUserAuth?: boolean
    isActive: boolean
}

type MCPClientResult = {
    tools: Record<string, any>
    clients: Array<{ close: () => Promise<void> }>
}

/** Run an async function with a hard timeout */
function withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
        fn().then(
            (result) => { clearTimeout(timer); resolve(result) },
            (err) => { clearTimeout(timer); reject(err) },
        )
    })
}

/**
 * Fetch decrypted user tokens for MCP servers that require user auth.
 * Returns a map of serverId -> decrypted token.
 */
async function getUserTokenMap(
    serverIds: string[],
    userId: string
): Promise<Record<string, string>> {
    if (serverIds.length === 0) return {}

    const { prisma } = await import("@/lib/prisma")
    const userTokens = await prisma.userMCPToken.findMany({
        where: {
            userId,
            serverId: { in: serverIds },
        },
        select: { serverId: true, tokenEnc: true, tokenIv: true },
    })

    const map: Record<string, string> = {}
    for (const t of userTokens) {
        try {
            map[t.serverId] = decryptToken(t.tokenEnc, t.tokenIv)
        } catch (err) {
            console.warn(`[MCP] Failed to decrypt user token for server ${t.serverId}`)
        }
    }
    return map
}

/**
 * Create MCP clients for active servers and fetch their tools at runtime.
 *
 * Called during every chat request to merge MCP tools into the tool set.
 * Each transport attempt gets a 6-second timeout so chat isn't blocked.
 * Servers that fail to connect are silently skipped.
 *
 * Token resolution:
 * - requiresUserAuth=false → uses developer's authToken
 * - requiresUserAuth=true  → uses user's encrypted token (decrypted at runtime)
 * - If user token is missing for a requiresUserAuth server, that server is skipped
 */
export async function getMCPTools(
    servers: MCPServerInput[],
    userId?: string
): Promise<MCPClientResult> {
    const tools: Record<string, any> = {}
    const clients: Array<{ close: () => Promise<void> }> = []

    const activeServers = servers.filter((s) => s.isActive)

    // Fetch user tokens for servers that need them
    const userAuthServerIds = activeServers
        .filter((s) => s.requiresUserAuth)
        .map((s) => s.id)

    const userTokenMap = userId && userAuthServerIds.length > 0
        ? await getUserTokenMap(userAuthServerIds, userId)
        : {}

    // Connect to all servers concurrently
    await Promise.allSettled(
        activeServers.map(async (server) => {
            const headers: Record<string, string> = {}

            if (server.requiresUserAuth) {
                // Prefer user's token, fall back to developer's token if available
                const userToken = userTokenMap[server.id]
                if (userToken) {
                    headers["Authorization"] = `Bearer ${userToken}`
                } else if (server.authToken) {
                    // Developer provided a fallback token
                    headers["Authorization"] = `Bearer ${server.authToken}`
                } else {
                    console.warn(`[MCP] Skipping ${server.label}: user auth required but no token provided`)
                    return
                }
            } else if (server.authToken) {
                // Use developer's token
                headers["Authorization"] = `Bearer ${server.authToken}`
            }

            const headerOpt = Object.keys(headers).length > 0 ? headers : undefined

            // Build transport attempts with URL auto-correction
            const attempts: Array<{ type: "sse" | "http"; url: string }> = [
                { type: "sse", url: server.serverUrl },
            ]
            if (server.serverUrl.endsWith("/sse")) {
                attempts.push({ type: "http", url: server.serverUrl.replace(/\/sse$/, "/mcp") })
            } else {
                attempts.push({ type: "http", url: server.serverUrl })
            }

            for (const attempt of attempts) {
                try {
                    const { client: c, toolSet } = await withTimeout(10_000, async () => {
                        const mc = await createMCPClient({
                            transport: {
                                type: attempt.type,
                                url: attempt.url,
                                headers: headerOpt,
                            },
                        })
                        const ts = await mc.tools()
                        return { client: mc, toolSet: ts }
                    })

                    clients.push(c)

                    // Prefix tool names to avoid collisions
                    const sanitizedLabel = server.label
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, "_")
                        .replace(/_+/g, "_")

                    for (const [name, toolDef] of Object.entries(toolSet)) {
                        tools[`mcp_${sanitizedLabel}_${name}`] = toolDef
                    }

                    return // Connected successfully, stop trying transports
                } catch {
                    // Try next transport type
                }
            }

            console.warn(`MCP server ${server.label} (${server.serverUrl}) unreachable, skipping`)
        })
    )

    return { tools, clients }
}

/**
 * Close all MCP clients after a streaming response finishes.
 * Call this in the onFinish callback of streamText().
 */
export async function closeMCPClients(clients: Array<{ close: () => Promise<void> }>) {
    await Promise.allSettled(clients.map((c) => c.close()))
}
