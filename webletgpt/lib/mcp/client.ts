import { createMCPClient } from "@ai-sdk/mcp"

type MCPServerInput = {
    id: string
    serverUrl: string
    label: string
    authToken?: string | null
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
 * Create MCP clients for active servers and fetch their tools at runtime.
 *
 * Called during every chat request to merge MCP tools into the tool set.
 * Each transport attempt gets a 6-second timeout so chat isn't blocked.
 * Servers that fail to connect are silently skipped.
 */
export async function getMCPTools(servers: MCPServerInput[]): Promise<MCPClientResult> {
    const tools: Record<string, any> = {}
    const clients: Array<{ close: () => Promise<void> }> = []

    const activeServers = servers.filter((s) => s.isActive)

    // Connect to all servers concurrently
    await Promise.allSettled(
        activeServers.map(async (server) => {
            const headers: Record<string, string> = {}
            if (server.authToken) {
                headers["Authorization"] = `Bearer ${server.authToken}`
            }
            const headerOpt = Object.keys(headers).length > 0 ? headers : undefined

            const transportTypes: Array<"sse" | "http"> = ["sse", "http"]

            for (const transportType of transportTypes) {
                try {
                    const { client, toolSet } = await withTimeout(6000, async () => {
                        const c = await createMCPClient({
                            transport: {
                                type: transportType,
                                url: server.serverUrl,
                                headers: headerOpt,
                            },
                        })
                        const ts = await c.tools()
                        return { client: c, toolSet: ts }
                    })

                    clients.push(client)

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
