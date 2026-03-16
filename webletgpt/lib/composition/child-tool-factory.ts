import { z } from "zod"
import { executeChildWeblet } from "./executor"

type CompositionInput = {
    id: string
    childWeblet: {
        id: string
        name: string
        slug: string
        description: string | null
        capabilities?: any
    }
    triggerCondition: string | null
    passingContext: any
}

const MAX_DEPTH = 3

function buildUseCases(caps: any): string {
    const uses: string[] = []
    if (caps.codeInterpreter) uses.push("scripts, data analysis, charts, web apps, file creation")
    if (caps.webSearch) uses.push("live web lookups, news, current events")
    if (caps.imageGen) uses.push("image creation")
    if (caps.fileSearch) uses.push("searching internal documents")
    return uses.join("; ")
}

function buildChildToolDescription(child: CompositionInput['childWeblet']): string {
    const caps = (child.capabilities as any) || {}
    const capList: string[] = []
    if (caps.webSearch) capList.push("web search")
    if (caps.codeInterpreter) capList.push("code execution & file creation (Python)")
    if (caps.imageGen) capList.push("image generation")
    if (caps.fileSearch) capList.push("knowledge base / file search")
    const capStr = capList.length > 0 ? capList.join(", ") : "general assistant"
    const useCases = buildUseCases(caps)
    return [
        `Specialist: ${child.name} | Capabilities: ${capStr}`,
        `Description: ${child.description || "A specialized assistant"}`,
        useCases ? `Use for: ${useCases}` : null,
        ``,
        `Provide a complete self-contained task. The specialist runs independently with no conversation history.`,
        caps.codeInterpreter ? `For file output say: "Save to /home/user/<filename> — do not return as text."` : null,
    ].filter(Boolean).join('\n')
}

/**
 * Convert child weblets into Vercel AI SDK tool definitions.
 *
 * Each child weblet becomes a callable tool named `weblet_{slug}`.
 * When the LLM invokes the tool, it calls the child weblet through
 * the full chat engine (so the child gets its own tools, RAG, etc.).
 *
 * Uses the same raw object format as other tools in the registry
 * (inputSchema + execute) for consistent provider compatibility.
 *
 * @param compositions - WebletComposition records with populated childWeblet
 * @param currentDepth - Current nesting depth (for recursion prevention)
 * @returns Record of tool definitions
 */
export function createChildWebletTools(
    compositions: CompositionInput[],
    currentDepth: number = 0,
    userId?: string
): Record<string, any> {
    const tools: Record<string, any> = {}

    if (currentDepth >= MAX_DEPTH) {
        console.warn(`Composition depth limit (${MAX_DEPTH}) reached, skipping child tools`)
        return tools
    }

    for (const comp of compositions) {
        const child = comp.childWeblet
        const toolName = `weblet_${child.slug.replace(/[^a-z0-9_]/g, "_")}`

        tools[toolName] = {
            description: buildChildToolDescription(child),
            inputSchema: z.object({
                message: z.string().describe("What to ask this weblet"),
            }),
            // Send structured execution summary to the parent LLM so it knows what
            // the specialist actually did (tool count, artifact types, duration).
            // Full _childExecution metadata still goes to the client UI via the raw result.
            toModelOutput: ({ output: result }: { toolCallId: string; input: unknown; output: any }) => {
                if (result?.error) return { type: 'text' as const, value: result.error }

                const agentName = result?.source || child.name
                const toolCalls: any[] = result?._childExecution?.toolCalls || []
                const durationMs: number = result?._childExecution?.durationMs || 0
                const durationStr = durationMs >= 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`
                const toolCount = toolCalls.length

                const toolCounts: Record<string, number> = {}
                for (const tc of toolCalls) {
                    toolCounts[tc.toolName] = (toolCounts[tc.toolName] || 0) + 1
                }

                const fileNames: string[] = []
                let chartCount = 0
                let imageCount = 0
                for (const tc of toolCalls) {
                    const r = tc?.result
                    if (!r || typeof r !== 'object') continue
                    if (r.url && typeof r.url === 'string') imageCount++
                    for (const img of r.data?.images || []) { if (img.url) chartCount++ }
                    for (const f of r.data?.files || []) { if (f.url && f.name) fileNames.push(f.name) }
                }

                const header = toolCount > 0
                    ? `=== [${agentName}] — ${toolCount} tool call${toolCount > 1 ? 's' : ''}, ${durationStr} ===`
                    : `=== [${agentName}] — text response only, ${durationStr} ===`

                let summaryBlock = ''
                if (toolCount > 0) {
                    const toolSummary = Object.entries(toolCounts)
                        .map(([name, count]) => `${name}${count > 1 ? ` ×${count}` : ''}`).join(', ')
                    const artifactLines: string[] = []
                    if (fileNames.length > 0) artifactLines.push(`- Files created: ${fileNames.join(', ')} (shown as download cards in UI — do not re-link)`)
                    if (chartCount > 0) artifactLines.push(`- Charts generated: ${chartCount} (shown inline in UI — do not re-link)`)
                    if (imageCount > 0) artifactLines.push(`- Images generated: ${imageCount} (shown inline in UI — do not re-link)`)
                    if (artifactLines.length === 0) artifactLines.push('- No files or images produced')
                    summaryBlock = `\n\nExecution summary:\n- Tools used: ${toolSummary}\n${artifactLines.join('\n')}`
                }

                return { type: 'text' as const, value: `${header}\n\n${result?.response || ''}${summaryBlock}` }
            },
            execute: async ({ message }: { message: string }) => {
                try {
                    const result = await executeChildWeblet(child.id, message, currentDepth + 1, userId)
                    return {
                        response: result.text,
                        source: child.name,
                        // _childExecution carries metadata the UI needs to render
                        // rich output (tool calls, images, files, timing).
                        // toModelOutput above ensures this data
                        // does NOT inflate the LLM's context.
                        _childExecution: {
                            toolCalls: result.toolCalls,
                            stepsUsed: result.stepsUsed,
                            durationMs: result.durationMs,
                        },
                    }
                } catch (error: any) {
                    return {
                        error: `Failed to get response from ${child.name}: ${error.message}`,
                        source: child.name,
                    }
                }
            },
        }
    }

    return tools
}
