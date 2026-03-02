import { createMCPClient } from "@ai-sdk/mcp"
import type { MCPToolDef } from "./config"

/**
 * Build a list of { transport, url } attempts to try.
 *
 * For a given serverUrl we always try the exact URL with SSE first.
 * Then we derive alternate URLs for the HTTP (streamable) transport:
 *   - If the URL ends with /sse  → also try replacing /sse with /mcp
 *   - If the URL ends with /mcp  → use as-is for HTTP
 *   - Otherwise                  → try the URL as-is for HTTP
 */
function buildTransportAttempts(serverUrl: string): Array<{ type: "sse" | "http"; url: string }> {
    const attempts: Array<{ type: "sse" | "http"; url: string }> = []

    // Always try SSE with the provided URL first
    attempts.push({ type: "sse", url: serverUrl })

    // Try HTTP with intelligent URL variants
    if (serverUrl.endsWith("/sse")) {
        // Server gave us an SSE URL — try the /mcp variant for streamable HTTP
        attempts.push({ type: "http", url: serverUrl.replace(/\/sse$/, "/mcp") })
    } else {
        attempts.push({ type: "http", url: serverUrl })
    }

    return attempts
}

/**
 * Discover tools from an MCP server by connecting to it and fetching tool definitions.
 *
 * Tries SSE transport first, then HTTP (with URL auto-correction).
 * Each attempt has a 15-second timeout so slower servers aren't skipped.
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

    const attempts = buildTransportAttempts(serverUrl)
    const errors: string[] = []

    for (const attempt of attempts) {
        let client: Awaited<ReturnType<typeof createMCPClient>> | undefined

        try {
            const tools = await withTimeout(15_000, async () => {
                client = await createMCPClient({
                    transport: {
                        type: attempt.type,
                        url: attempt.url,
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
            const msg = `${attempt.type}@${attempt.url}: ${error.message || "unknown error"}`
            console.warn(`MCP discovery [${attempt.type}] failed for ${attempt.url}:`, error.message)
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
