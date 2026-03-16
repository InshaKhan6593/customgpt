import { generateText, stepCountIs } from "ai"
import { stopWhenAny, noProgressDetected } from "@/lib/ai/stop-conditions"
import { getLanguageModel } from "@/lib/ai/openrouter"
import { getActiveVersion } from "@/lib/chat/engine"
import { getToolsFromCapabilities } from "@/lib/tools/registry"
import { createPersistentSandbox } from "@/lib/tools/code-interpreter"
import { getToolsFromOpenAPI } from "@/lib/tools/openapi"
import { getMCPTools, closeMCPClients } from "@/lib/mcp/client"
import { resolveCompositions } from "./resolver"
import { createChildWebletTools } from "./child-tool-factory"
import { langfuseSpanProcessor } from "@/instrumentation"
import { autoCompactMessages } from "@/lib/utils/truncate"
import { prisma } from "@/lib/prisma"
import { logUsage } from "@/lib/billing/usage-logger"

// Token budget for child agent's context — triggers compaction when exceeded
const CHILD_CONTEXT_BUDGET = 24_000

// Hard timeout for a single child-weblet execution (3 minutes)
// Prevents a runaway child from blocking the parent indefinitely.
const CHILD_EXECUTION_TIMEOUT_MS = 3 * 60 * 1000

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
 * Key production-grade properties:
 * - Persistent E2B sandbox: a single sandbox is created before generateText and
 *   shared across ALL codeInterpreter calls within this execution. Variables,
 *   installed packages, and files persist between calls — the child can do
 *   data loading → analysis → visualization without repeating setup.
 * - Hard timeout: AbortController cancels generateText after 3 minutes so a
 *   hung child never blocks the parent indefinitely.
 * - Safe cleanup: sandbox and MCP clients are always closed in a finally block.
 * - Billing: child token usage is logged to the child weblet's developer account.
 */
export async function executeChildWeblet(
    childWebletId: string,
    message: string,
    depth: number,
    userId?: string
): Promise<ChildExecutionResult> {
    const startTime = Date.now()

    // Load child's active version (system prompt, model, openapiSchema)
    const activeVersion = await getActiveVersion(childWebletId)
    if (!activeVersion) {
        throw new Error("Child weblet has no active configuration")
    }

    // Fetch child capabilities and MCP servers in one query
    const childWeblet = await prisma.weblet.findUnique({
        where: { id: childWebletId },
        select: {
            capabilities: true,
            mcpServers: { where: { isActive: true } },
        },
    })

    // ── Persistent E2B sandbox ──────────────────────────────────────────────
    // Create ONE sandbox before generateText begins. All codeInterpreter calls
    // share it — state (variables, imports, installed packages, /home/user files)
    // persists across calls. Killed in the finally block.
    const caps = childWeblet?.capabilities as any
    const persistentSandbox = caps?.codeInterpreter
        ? await createPersistentSandbox()
        : null

    // ── AbortController for hard timeout ───────────────────────────────────
    const controller = new AbortController()
    const timeoutHandle = setTimeout(
        () => controller.abort(new Error(`Child weblet timed out after ${CHILD_EXECUTION_TIMEOUT_MS / 1000}s`)),
        CHILD_EXECUTION_TIMEOUT_MS
    )

    let mcpClients: Array<{ close: () => Promise<void> }> = []

    try {
        // Build tool set — pass persistentSandbox so codeInterpreter uses shared state
        let tools = getToolsFromCapabilities(
            childWeblet?.capabilities,
            childWebletId,
            persistentSandbox ?? undefined
        )

        // OpenAPI custom actions
        if (activeVersion.openapiSchema) {
            const openAPITools = getToolsFromOpenAPI(
                typeof activeVersion.openapiSchema === "string"
                    ? activeVersion.openapiSchema
                    : JSON.stringify(activeVersion.openapiSchema)
            )
            tools = { ...tools, ...openAPITools }
        }

        // MCP server tools
        if (childWeblet?.mcpServers && childWeblet.mcpServers.length > 0) {
            const mcpServers = childWeblet.mcpServers.map((s: any) => ({
                ...s,
                tools: s.tools as any[] | null,
                webletId: childWebletId,
            }))
            const mcpResult = await getMCPTools(mcpServers, userId)
            tools = { ...tools, ...mcpResult.tools }
            mcpClients = mcpResult.clients
        }

        // Nested child compositions (recursive composability, capped at MAX_DEPTH)
        const childCompositions = await resolveCompositions(childWebletId)
        if (childCompositions.length > 0) {
            const childTools = createChildWebletTools(childCompositions, depth, userId)
            tools = { ...tools, ...childTools }
        }

        const modelId = activeVersion.model || "anthropic/claude-3.5-sonnet"
        const model = getLanguageModel(modelId)

        // ── System prompt ────────────────────────────────────────────────────
        // The child's own developer-configured prompt is the foundation.
        // We append sub-agent operating guidelines WITHOUT overriding the persona.
        // First, build a capability summary so the child knows what tools it has.
        const capabilityLines: string[] = []
        if (caps?.codeInterpreter) capabilityLines.push('- **codeInterpreter**: Execute Python code, create files/scripts/apps/charts. Files saved to /home/user/ become downloadable artifacts.')
        if (caps?.webSearch) capabilityLines.push('- **webSearch**: Search the web for live information.')
        if (caps?.imageGen) capabilityLines.push('- **imageGeneration**: Generate images from text prompts.')
        if (caps?.fileSearch) capabilityLines.push('- **fileSearch**: Search uploaded knowledge base documents.')
        const mcpToolNames = Object.keys(tools).filter(t => t.startsWith('mcp_'))
        if (mcpToolNames.length > 0) capabilityLines.push(`- **MCP tools**: ${mcpToolNames.map(t => `\`${t}\``).join(', ')}`)

        const capabilityBlock = capabilityLines.length > 0
            ? `\n\n## Your Tools\n${capabilityLines.join('\n')}\nUse these proactively — do not describe what you would do, USE the tool.\n`
            : ''

        const compositionPrompt = `${activeVersion.prompt}${capabilityBlock}

---
## Sub-Agent Operating Mode

You are operating as a **specialized sub-agent** invoked by a parent AI orchestrator. Your role is to complete the specific task in the user message and return a clean, structured result.

### Core Rules
- Focus exclusively on the task described. Do not add preamble, meta-commentary, or conversational filler.
- Produce a **complete, self-contained response** the parent can use directly — include all findings, results, and conclusions.
- **CRITICAL: Use your tools to DO the work — never describe or plan what you would do instead of doing it.** If you have codeInterpreter, execute the code now. If asked to create a file, write it now via codeInterpreter.
- Do not ask for clarification; make reasonable assumptions and proceed.
- **NEVER echo raw JSON, data frames, or tool output verbatim.** Always synthesize into clear prose or structured markdown.
- **If tools are available and the task requires them** (codeInterpreter for code/files, webSearch for live info), **you MUST use them**. A text-only response when a relevant tool is both available and applicable is an incomplete response.

### When to Produce Artifacts
Use judgment — generate charts and files when they genuinely add value, not for every response:
- **Code files / scripts / apps**: If the task asks you to create a script, app, or any file — use codeInterpreter to WRITE and SAVE it to /home/user/<filename>. Do NOT just paste code as text. The user needs a downloadable file.
- **Charts**: Generate when the task involves data trends, comparisons, distributions, or any result that is clearer as a visual than as text.
  - **Matplotlib/Seaborn**: use plt.show() → renders inline in the UI.
  - **Plotly**: fig.show() does NOT render inline here — use fig.write_image('/home/user/chart.png') instead (produces a downloadable file artifact).
  - NEVER use plt.savefig() if you want inline rendering; use plt.show() for matplotlib inline charts.
- **Files**: Save to /home/user/<filename> when the output is substantial — a full script, a dataset, a report, or anything the user would want to download and reuse. Small snippets or one-liners belong inline.
- **Skip artifacts** for quick calculations, simple lookups, or short text answers — just respond directly.
- **Sandbox state persists**: Variables, imports, installed packages, and files from previous codeInterpreter calls in this session are still in scope — do not repeat setup.

### Artifact Rendering (IMPORTANT)
- Charts and files you create via codeInterpreter are **automatically rendered in the UI** as inline images and download cards. The user already sees them.
- **Do NOT list, re-link, or enumerate created files in your text response.** No numbered lists of file names, no markdown links to artifacts, no "Here are the files:" sections. This creates ugly duplication.
- Instead, briefly describe **what you built and how to use it** — e.g., "I built a Flask calculator app with a clean UI. Run it with \`python app.py\` and open localhost:5000." The files themselves are already visible above your response.

### Response Format
- Use markdown with headers, bullet points, and code blocks where appropriate.
- Lead with the key answer or finding.
- Keep it concise — the artifacts speak for themselves.`

        // ── Execute ──────────────────────────────────────────────────────────
        const result = await generateText({
            model,
            system: compositionPrompt,
            messages: [{ role: "user", content: message }],
            tools,
            stopWhen: stopWhenAny(stepCountIs(10), noProgressDetected(5)),
            abortSignal: controller.signal,
            prepareStep: async ({ messages: stepMessages }) => {
                const compacted = await autoCompactMessages(stepMessages, CHILD_CONTEXT_BUDGET, model)
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

        clearTimeout(timeoutHandle)
        await langfuseSpanProcessor.forceFlush()

        // ── Billing ──────────────────────────────────────────────────────────
        const totalUsage = (result as any).totalUsage ?? result.usage
        if (totalUsage?.totalTokens && userId) {
            const childDev = await prisma.weblet.findUnique({
                where: { id: childWebletId },
                select: { developerId: true },
            })
            if (childDev) {
                const toolCounts: Record<string, number> = {}
                for (const step of result.steps ?? []) {
                    for (const tc of step.toolCalls ?? []) {
                        toolCounts[tc.toolName] = (toolCounts[tc.toolName] || 0) + 1
                    }
                }
                logUsage({
                    userId,
                    webletId: childWebletId,
                    developerId: childDev.developerId,
                    tokensIn: (totalUsage as any).promptTokens || (totalUsage as any).inputTokens || 0,
                    tokensOut: (totalUsage as any).completionTokens || (totalUsage as any).outputTokens || 0,
                    modelId,
                    toolCalls: Object.keys(toolCounts).length > 0 ? toolCounts : null,
                    source: "COMPOSABILITY",
                }).catch(err => console.error("Failed to log child weblet usage:", err))
            }
        }

        // ── Collect tool call details for UI visibility ─────────────────────
        // AI SDK v6 uses `.input` / `.output` on tool calls/results (not `.args` / `.result`).
        const toolCalls: ChildToolCallDetail[] = []
        for (const step of result.steps ?? []) {
            if (!step.toolCalls?.length) continue
            for (let i = 0; i < step.toolCalls.length; i++) {
                const tc = step.toolCalls[i] as any
                const tr = (step.toolResults as any[])?.[i]
                toolCalls.push({
                    toolName: tc.toolName,
                    args: tc.input ?? tc.args ?? {},
                    result: tr?.output ?? tr?.result ?? null,
                })
            }
        }

        // Debug: log artifact summary from child execution
        const artifactSummary = toolCalls.map(tc => ({
            tool: tc.toolName,
            images: tc.result?.data?.images?.length ?? 0,
            files: tc.result?.data?.files?.length ?? 0,
        }))
        console.log(`[Executor] Child ${childWebletId} toolCalls:`, JSON.stringify(artifactSummary))

        return {
            text: result.text || "No response from child weblet",
            toolCalls,
            stepsUsed: result.steps?.length || 1,
            durationMs: Date.now() - startTime,
        }

    } finally {
        clearTimeout(timeoutHandle)

        // Always clean up — order matters: sandbox before MCP clients
        if (persistentSandbox) {
            persistentSandbox.kill().catch((err: any) =>
                console.error("[E2B] Failed to kill persistent sandbox:", err)
            )
        }
        if (mcpClients.length > 0) {
            closeMCPClients(mcpClients).catch(err =>
                console.error("Failed to close MCP clients:", err)
            )
        }
    }
}
