import { createMCPClient } from "@ai-sdk/mcp"
import type { MCPToolDef } from "./config"

/**
 * Discover tools from an MCP server by connecting to it and fetching tool definitions.
 *
 * Tries SSE transport first, then HTTP. Each attempt has a 8-second timeout
 * so we don't hang forever on unreachable servers.
 */
export async function discoverMCPTools(
    serverUrl: string,
    authToken?: string | null
): Promise<MCPToolDef[]> {
    const headers: Record<string, string> = {}
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`
    }
    const headerOpt = Object.keys(headers).length > 0 ? headers : undefined

    const transportTypes: Array<"sse" | "http"> = ["sse", "http"]
    const errors: string[] = []

    for (const transportType of transportTypes) {
        let client: Awaited<ReturnType<typeof createMCPClient>> | undefined

        try {
            const tools = await withTimeout(8000, async () => {
                client = await createMCPClient({
                    transport: {
                        type: transportType,
                        url: serverUrl,
                        headers: headerOpt,
                    },
                })

                const toolSet = await client.tools()

                return Object.entries(toolSet).map(([name, toolDef]) => ({
                    name,
                    description: (toolDef as any)?.description || "",
                    inputSchema: (toolDef as any)?.parameters
                        ? JSON.parse(JSON.stringify((toolDef as any).parameters))
                        : undefined,
                }))
            })

            return tools
        } catch (error: any) {
            const msg = `${transportType}: ${error.message || "unknown error"}`
            console.warn(`MCP discovery [${transportType}] failed for ${serverUrl}:`, error.message)
            errors.push(msg)
        } finally {
            if (client) {
                try { await client.close() } catch { /* ignore */ }
            }
        }
    }

    throw new Error(
        `Failed to discover tools from ${serverUrl}. Tried: ${errors.join(" | ")}`
    )
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
