import { generateText, stepCountIs } from "ai"
import type { ModelMessage, StepResult } from "ai"
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
import { checkQuotas } from "@/lib/billing/quota-check"

// Token budget for child agent's context — triggers compaction when exceeded
const CHILD_CONTEXT_BUDGET = 24_000

// Per-attempt timeout. First attempt gets the full budget; retries get less
// to cap total wall time at ~7 minutes worst case (180 + 120 + 120).
const ATTEMPT_TIMEOUTS_MS = [3 * 60 * 1000, 2 * 60 * 1000, 2 * 60 * 1000]

// Maximum retry attempts after a timeout (total calls = MAX_RETRIES + 1)
const MAX_RETRIES = 2

export interface ChildToolCallDetail {
    toolName: string
    args: Record<string, any>
    result: any
}

export interface PresentedArtifact {
    type: string
    url: string
    title: string | null
    caption: string | null
    mimeType: string | null
    fileName: string | null
}

export interface ChildExecutionResult {
    text: string
    toolCalls: ChildToolCallDetail[]
    presentedArtifacts: PresentedArtifact[]
    stepsUsed: number
    durationMs: number
}

export async function executeChildWeblet(
    childWebletId: string,
    message: string,
    depth: number,
    userId?: string
): Promise<ChildExecutionResult> {
    const startTime = Date.now()

    const activeVersion = await getActiveVersion(childWebletId)
    if (!activeVersion) {
        throw new Error("Child weblet has no active configuration")
    }

    const childWeblet = await prisma.weblet.findUnique({
        where: { id: childWebletId },
        select: {
            capabilities: true,
            mcpServers: { where: { isActive: true } },
        },
    })

    if (userId) {
        const quotaCheck = await checkQuotas(userId, childWebletId)
        if (!quotaCheck.allowed) {
            throw new Error(`Child weblet execution blocked: ${quotaCheck.reason || 'insufficient credits'}`)
        }
    }

    const caps = childWeblet?.capabilities as any
    const persistentSandbox = caps?.codeInterpreter
        ? await createPersistentSandbox()
        : null

    let mcpClients: Array<{ close: () => Promise<void> }> = []

    try {
        let tools = {
            ...getToolsFromCapabilities(
                childWeblet?.capabilities,
                childWebletId,
                persistentSandbox ?? undefined
            ),
        }

        if (activeVersion.openapiSchema) {
            const openAPITools = getToolsFromOpenAPI(
                typeof activeVersion.openapiSchema === "string"
                    ? activeVersion.openapiSchema
                    : JSON.stringify(activeVersion.openapiSchema)
            )
            tools = { ...tools, ...openAPITools }
        }

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

        const childCompositions = await resolveCompositions(childWebletId)
        if (childCompositions.length > 0) {
            const childTools = createChildWebletTools(childCompositions, depth, userId)
            tools = { ...tools, ...childTools }
        }

        const modelId = activeVersion.model || "anthropic/claude-3.5-sonnet"
        const model = getLanguageModel(modelId)

        const compositionPrompt = buildCompositionPrompt(activeVersion.prompt, caps, tools)

        // ── Retry loop with resume ───────────────────────────────────────────
        // On timeout, captured steps provide the conversation history to resume from.
        // Sandbox and MCP clients stay alive across retries (cleaned in outer finally).
        let currentMessages: ModelMessage[] = [{ role: "user", content: message }]
        const allToolCalls: ChildToolCallDetail[] = []
        const allArtifacts: PresentedArtifact[] = []
        let totalStepsUsed = 0
        let totalPromptTokens = 0
        let totalCompletionTokens = 0
        let finalText = ""
        let lastError: Error | null = null

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const timeoutMs = ATTEMPT_TIMEOUTS_MS[attempt] ?? ATTEMPT_TIMEOUTS_MS[ATTEMPT_TIMEOUTS_MS.length - 1]
            const controller = new AbortController()
            const timeoutHandle = setTimeout(
                () => controller.abort(new Error(`Child weblet timed out after ${timeoutMs / 1000}s (attempt ${attempt + 1})`)),
                timeoutMs,
            )

            const capturedSteps: StepResult<any>[] = []

            try {
                const remainingSteps = Math.max(3, 10 - totalStepsUsed)

                const result = await generateText({
                    model,
                    system: compositionPrompt,
                    messages: currentMessages,
                    tools,
                    stopWhen: stopWhenAny(stepCountIs(remainingSteps), noProgressDetected(5)),
                    abortSignal: controller.signal,
                    onStepFinish: (step: StepResult<any>) => {
                        capturedSteps.push(step)
                    },
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
                            attempt: String(attempt + 1),
                        },
                    },
                })

                clearTimeout(timeoutHandle)

                const { toolCalls, artifacts } = extractToolCallsAndArtifacts(result.steps ?? [])
                allToolCalls.push(...toolCalls)
                allArtifacts.push(...artifacts)
                totalStepsUsed += result.steps?.length || 1

                const usage = (result as any).totalUsage ?? result.usage
                totalPromptTokens += (usage as any)?.promptTokens || (usage as any)?.inputTokens || 0
                totalCompletionTokens += (usage as any)?.completionTokens || (usage as any)?.outputTokens || 0

                finalText = result.text || ""
                lastError = null
                break
            } catch (error: any) {
                clearTimeout(timeoutHandle)
                lastError = error

                const isAbortError = error?.name === 'AbortError'
                    || error?.message?.includes('timed out')
                    || controller.signal.aborted

                if (!isAbortError) throw error

                if (capturedSteps.length > 0) {
                    const { toolCalls, artifacts } = extractToolCallsAndArtifacts(capturedSteps)
                    allToolCalls.push(...toolCalls)
                    allArtifacts.push(...artifacts)
                    totalStepsUsed += capturedSteps.length

                    const lastStep = capturedSteps[capturedSteps.length - 1] as any
                    const resumeMessages = lastStep?.response?.messages
                    if (resumeMessages && Array.isArray(resumeMessages) && resumeMessages.length > 0) {
                        currentMessages = [
                            { role: "user" as const, content: message },
                            ...resumeMessages,
                        ]
                    }

                    finalText = lastStep?.text || finalText

                    for (const step of capturedSteps) {
                        const stepUsage = (step as any).usage
                        if (stepUsage) {
                            totalPromptTokens += stepUsage.promptTokens || stepUsage.inputTokens || 0
                            totalCompletionTokens += stepUsage.completionTokens || stepUsage.outputTokens || 0
                        }
                    }

                    if (attempt < MAX_RETRIES) {
                        console.log(
                            `[Executor] Child ${childWebletId} timed out after ${capturedSteps.length} steps (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Resuming with ${currentMessages.length} messages...`
                        )
                        continue
                    }
                }

                if (attempt >= MAX_RETRIES) {
                    console.log(
                        `[Executor] Child ${childWebletId} exhausted all ${MAX_RETRIES + 1} attempts. Total steps completed: ${totalStepsUsed}`
                    )
                    break
                }
            }
        }

        await langfuseSpanProcessor.forceFlush()

        if (userId && (totalPromptTokens > 0 || totalCompletionTokens > 0)) {
            const childDev = await prisma.weblet.findUnique({
                where: { id: childWebletId },
                select: { developerId: true },
            })
            if (childDev) {
                const toolCounts: Record<string, number> = {}
                for (const tc of allToolCalls) {
                    toolCounts[tc.toolName] = (toolCounts[tc.toolName] || 0) + 1
                }
                logUsage({
                    userId,
                    webletId: childWebletId,
                    developerId: childDev.developerId,
                    tokensIn: totalPromptTokens,
                    tokensOut: totalCompletionTokens,
                    modelId,
                    toolCalls: Object.keys(toolCounts).length > 0 ? toolCounts : null,
                    source: "COMPOSABILITY",
                }).catch(err => console.error("Failed to log child weblet usage:", err))
            }
        }

        const artifactSummary = allToolCalls.map(tc => ({
            tool: tc.toolName,
            images: tc.result?.data?.images?.length ?? 0,
            files: tc.result?.data?.files?.length ?? 0,
        }))
        console.log(`[Executor] Child ${childWebletId} toolCalls:`, JSON.stringify(artifactSummary))

        if (!finalText && allToolCalls.length === 0 && lastError) {
            throw lastError
        }

        return {
            text: finalText || "No response from child weblet",
            toolCalls: allToolCalls,
            presentedArtifacts: allArtifacts,
            stepsUsed: totalStepsUsed,
            durationMs: Date.now() - startTime,
        }

    } finally {
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

function buildCompositionPrompt(basePrompt: string, caps: any, tools: Record<string, any>): string {
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

    return `${basePrompt}${capabilityBlock}

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

### Artifact Handling
- Your artifacts (images, files, charts) are automatically collected and relayed to the parent agent.
- Do NOT try to call presentToUser — you do not have that tool. The parent handles presentation.
- Just describe what you created in your text response (e.g. "I generated a bar chart comparing X and Y").
- The parent will display the artifacts to the user on your behalf.

### Response Format
- Use markdown with headers, bullet points, and code blocks where appropriate.
- Lead with the key answer or finding.
- Keep it concise — the artifacts speak for themselves.`
}

function extractToolCallsAndArtifacts(steps: StepResult<any>[]): {
    toolCalls: ChildToolCallDetail[]
    artifacts: PresentedArtifact[]
} {
    const toolCalls: ChildToolCallDetail[] = []
    for (const step of steps) {
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

    const artifacts: PresentedArtifact[] = []
    for (const tc of toolCalls) {
        const r = tc.result
        if (!r || typeof r !== 'object') continue

        if (tc.toolName === 'imageGeneration' && r.url) {
            artifacts.push({
                type: 'image',
                url: r.url,
                title: null,
                caption: null,
                mimeType: null,
                fileName: null,
            })
        }

        if (tc.toolName === 'codeInterpreter') {
            for (const img of r.data?.images || []) {
                if (img.url) {
                    artifacts.push({
                        type: 'chart',
                        url: img.url,
                        title: null,
                        caption: null,
                        mimeType: null,
                        fileName: null,
                    })
                }
            }
            for (const f of r.data?.files || []) {
                if (f.url) {
                    artifacts.push({
                        type: 'file',
                        url: f.url,
                        title: f.name || null,
                        caption: null,
                        mimeType: null,
                        fileName: f.name || null,
                    })
                }
            }
        }
    }

    return { toolCalls, artifacts }
}
