import { createMCPClient } from "@ai-sdk/mcp"
import { z } from "zod"
import { getValidAccessToken } from "./oauth-refresh"

export type MCPServerInput = {
    id: string
    serverUrl: string
    label: string
    authToken?: string | null
    requiresUserAuth?: boolean
    isActive: boolean
    catalogId?: string | null
    tools?: any[] | null // Cached tool definitions from discovery
    webletId?: string
}

type StoredUserToken = {
    serverId: string
    tokenEnc: string
    tokenIv: string
    refreshTokenEnc: string | null
    refreshTokenIv: string | null
    expiresAt: Date | null
    tokenType: string | null
}

export type MCPClientResult = {
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
 * Fetch user tokens for MCP servers that require user auth.
 * Returns a map of serverId -> full token record (with OAuth fields).
 */
async function getUserTokenMap(
    serverIds: string[],
    userId: string
): Promise<Record<string, StoredUserToken>> {
    if (serverIds.length === 0) return {}

    const { prisma } = await import("@/lib/prisma")
    const userTokens = await prisma.userMCPToken.findMany({
        where: {
            userId,
            serverId: { in: serverIds },
        },
        select: {
            serverId: true,
            tokenEnc: true,
            tokenIv: true,
            refreshTokenEnc: true,
            refreshTokenIv: true,
            expiresAt: true,
            tokenType: true,
        },
    })

    const map: Record<string, StoredUserToken> = {}
    for (const t of userTokens) {
        map[t.serverId] = t
    }
    return map
}

/**
 * Sanitize a server label into a tool name prefix.
 */
function sanitizeLabel(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
}

/**
 * Create stub tools for an MCP server that requires user auth but has no token.
 * Each stub returns an `__mcp_auth_required` sentinel that the frontend detects
 * and renders as an inline "Connect your account" prompt.
 */
function createAuthStubTools(
    server: MCPServerInput,
    tools: Record<string, any>
): void {
    const sanitized = sanitizeLabel(server.label)
    const cachedTools = server.tools as Array<{ name: string; description?: string; inputSchema?: any }> | null

    const authPayload = {
        __mcp_auth_required: true,
        serverId: server.id,
        serverLabel: server.label,
        catalogId: server.catalogId || null,
        webletId: server.webletId || null,
        authType: (server as any).authType || "BEARER_TOKEN", // Let frontend pick correct auth UI
    }

    if (cachedTools && cachedTools.length > 0) {
        for (const cached of cachedTools) {
            const toolName = `mcp_${sanitized}_${cached.name}`
            tools[toolName] = {
                description: cached.description || `Tool from ${server.label} (requires authentication)`,
                inputSchema: cached.inputSchema || z.object({}),
                execute: async () => authPayload,
            }
        }
    } else {
        tools[`mcp_${sanitized}_connect`] = {
            description: `Connect to ${server.label} (requires authentication)`,
            inputSchema: z.object({
                message: z.string().describe("What you want to do with this service"),
            }),
            execute: async () => authPayload,
        }
    }
}

/**
 * Create MCP clients for active servers and fetch their tools at runtime.
 *
 * Called during every chat request to merge MCP tools into the tool set.
 * Each transport attempt gets a 10-second timeout so chat isn't blocked.
 *
 * Token resolution:
 * - requiresUserAuth=false → uses developer's authToken
 * - requiresUserAuth=true  → uses user's encrypted token (decrypted at runtime)
 * - If user token is missing → creates stub tools that return __mcp_auth_required
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
                const storedToken = userTokenMap[server.id]

                if (storedToken) {
                    // Resolve token (handles OAuth refresh if needed)
                    const accessToken = await getValidAccessToken(
                        storedToken,
                        server.id,
                        userId!,
                        server.catalogId || null
                    )

                    if (accessToken) {
                        headers["Authorization"] = `Bearer ${accessToken}`
                    } else {
                        // Token expired and refresh failed — show auth prompt
                        createAuthStubTools(server, tools)
                        return
                    }
                } else if (server.authToken) {
                    // Developer provided a fallback token
                    headers["Authorization"] = `Bearer ${server.authToken}`
                } else {
                    // No user token and no fallback — create stub tools for on-demand auth
                    createAuthStubTools(server, tools)
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

                    const sanitized = sanitizeLabel(server.label)
                    for (const [name, toolDef] of Object.entries(toolSet)) {
                        tools[`mcp_${sanitized}_${name}`] = toolDef
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
