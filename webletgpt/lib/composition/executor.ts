import { generateText, stepCountIs } from "ai"
import { getLanguageModel } from "@/lib/ai/openrouter"
import { getActiveVersion } from "@/lib/chat/engine"
import { getToolsFromCapabilities } from "@/lib/tools/registry"
import { getToolsFromOpenAPI } from "@/lib/tools/openapi"
import { getMCPTools, closeMCPClients } from "@/lib/mcp/client"
import { resolveCompositions } from "./resolver"
import { createChildWebletTools } from "./child-tool-factory"
import { langfuseSpanProcessor } from "@/instrumentation"
import { autoCompactMessages } from "@/lib/utils/truncate"

// Token budget for child agent's context — triggers compaction when exceeded
const CHILD_CONTEXT_BUDGET = 24_000

export interface ChildToolCallDetail {
    toolName: string
    args: Record<string, any>
    result: any
}

export interface ChildExecutionResult {
    text: string
    toolCalls: ChildToolCallDetail[]
    stepsUsed: number
    durationMs: number
}

/**
 * Execute a child weblet by running a single message through the chat engine.
 *
 * This is called when a parent weblet's LLM invokes a `weblet_{slug}` tool.
 * The child weblet gets fully resolved — its own system prompt, tools,
 * capabilities, and even its own child compositions (up to MAX_DEPTH).
 *
 * Uses `generateText` (not streaming) since the parent is waiting for the result.
 * Returns a structured result with the text output AND metadata about what the
 * child did (tool calls, timing) so the UI can display it.
 *
 * @param childWebletId - The child weblet to execute
 * @param message - The user message to send
 * @param depth - Current nesting depth
 * @returns Structured result with text + tool call metadata
 */
export async function executeChildWeblet(
    childWebletId: string,
    message: string,
    depth: number,
    userId?: string
): Promise<ChildExecutionResult> {
    const startTime = Date.now()

    // Load child's active version (system prompt + model + openapiSchema)
    const activeVersion = await getActiveVersion(childWebletId)
    if (!activeVersion) {
        throw new Error("Child weblet has no active configuration")
    }

    // Get child's own tools from capabilities, MCP servers, and OpenAPI schema
    const { prisma } = await import("@/lib/prisma")
    const childWeblet = await prisma.weblet.findUnique({
        where: { id: childWebletId },
        select: {
            capabilities: true,
            mcpServers: { where: { isActive: true } },
        },
    })

    let tools = getToolsFromCapabilities(childWeblet?.capabilities, childWebletId)

    // OpenAPI custom actions from the child's active version
    if (activeVersion.openapiSchema) {
        const openAPITools = getToolsFromOpenAPI(
            typeof activeVersion.openapiSchema === "string"
                ? activeVersion.openapiSchema
                : JSON.stringify(activeVersion.openapiSchema)
        )
        tools = { ...tools, ...openAPITools }
    }

    // MCP server tools — pass userId for user-auth servers
    let mcpClients: Array<{ close: () => Promise<void> }> = []
    if (childWeblet?.mcpServers && childWeblet.mcpServers.length > 0) {
        const mcpResult = await getMCPTools(childWeblet.mcpServers, userId)
        tools = { ...tools, ...mcpResult.tools }
        mcpClients = mcpResult.clients
    }

    // Resolve child's own compositions (nested composability)
    const childCompositions = await resolveCompositions(childWebletId)
    if (childCompositions.length > 0) {
        const childTools = createChildWebletTools(childCompositions, depth, userId)
        tools = { ...tools, ...childTools }
    }

    const modelId = activeVersion.model || "anthropic/claude-3.5-sonnet"

    // Build system prompt with composition context
    const compositionPrompt = `${activeVersion.prompt}

You are operating as a specialized sub-agent called by a parent agent.
- Focus ONLY on the specific task in the message you receive.
- Return a clear, well-structured response the parent agent can use directly.
- Use your available tools when they improve response quality.
- NEVER echo raw tool output (JSON, arrays). Always synthesize into natural language.
- No preamble, no conversational filler, no meta-commentary about being a sub-agent.`

    const model = getLanguageModel(modelId)

    // Execute using generateText (synchronous — parent is waiting)
    // prepareStep handles mid-loop compaction: if the child's context grows
    // beyond CHILD_CONTEXT_BUDGET (from multiple tool calls with large results),
    // autoCompactMessages summarizes older messages while keeping recent ones —
    // exactly like Claude Code's context buffer. The child resumes its task
    // without losing what it learned.
    const result = await generateText({
        model,
        system: compositionPrompt,
        messages: [{ role: "user", content: message }],
        tools,
        stopWhen: stepCountIs(10),
        prepareStep: async ({ messages }) => {
            const compacted = await autoCompactMessages(messages, CHILD_CONTEXT_BUDGET, model)
            return { messages: compacted }
        },
        experimental_telemetry: {
            isEnabled: true,
            metadata: {
                webletId: childWebletId,
                mode: "COMPOSITION",
                depth: String(depth),
            },
        },
    })

    await langfuseSpanProcessor.forceFlush()

    // Close MCP clients to free resources
    if (mcpClients.length > 0) {
        await closeMCPClients(mcpClients)
    }

    // Extract tool call details from all steps for UI visibility
    const toolCalls: ChildToolCallDetail[] = []
    if (result.steps) {
        for (const step of result.steps) {
            if (step.toolCalls && step.toolCalls.length > 0) {
                for (let i = 0; i < step.toolCalls.length; i++) {
                    const tc = step.toolCalls[i] as any
                    const tr = (step.toolResults as any[])?.[i]
                    toolCalls.push({
                        toolName: tc.toolName,
                        args: tc.args || {},
                        result: tr?.result ?? null,
                    })
                }
            }
        }
    }

    return {
        text: result.text || "No response from child weblet",
        toolCalls,
        stepsUsed: result.steps?.length || 1,
        durationMs: Date.now() - startTime,
    }
}
