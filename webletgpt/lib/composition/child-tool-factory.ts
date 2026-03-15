import { z } from "zod"
import { executeChildWeblet } from "./executor"

type CompositionInput = {
    id: string
    childWeblet: {
        id: string
        name: string
        slug: string
        description: string | null
    }
    triggerCondition: string | null
    passingContext: any
}

const MAX_DEPTH = 3

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
            description: `Use the "${child.name}" weblet: ${child.description || "A specialized AI assistant"}`,
            inputSchema: z.object({
                message: z.string().describe("What to ask this weblet"),
            }),
            execute: async ({ message }: { message: string }) => {
                try {
                    const result = await executeChildWeblet(child.id, message, currentDepth + 1, userId)
                    // Return only text to the LLM — _childExecution metadata inflates tokens
                    return {
                        response: result.text,
                        source: child.name,
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
