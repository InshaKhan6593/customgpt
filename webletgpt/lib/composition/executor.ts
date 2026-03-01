import { generateText, stepCountIs } from "ai"
import { getLanguageModel } from "@/lib/ai/openrouter"
import { getActiveVersion } from "@/lib/chat/engine"
import { getToolsFromCapabilities } from "@/lib/tools/registry"
import { resolveCompositions } from "./resolver"
import { createChildWebletTools } from "./child-tool-factory"

/**
 * Execute a child weblet by running a single message through the chat engine.
 *
 * This is called when a parent weblet's LLM invokes a `weblet_{slug}` tool.
 * The child weblet gets fully resolved — its own system prompt, tools,
 * capabilities, and even its own child compositions (up to MAX_DEPTH).
 *
 * Uses `generateText` (not streaming) since the parent is waiting for the result.
 *
 * @param childWebletId - The child weblet to execute
 * @param message - The user message to send
 * @param depth - Current nesting depth
 * @returns The text response from the child weblet
 */
export async function executeChildWeblet(
    childWebletId: string,
    message: string,
    depth: number
): Promise<string> {
    // Load child's active version (system prompt + model)
    const activeVersion = await getActiveVersion(childWebletId)
    if (!activeVersion) {
        throw new Error("Child weblet has no active configuration")
    }

    // Get child's own tools from capabilities
    const { prisma } = await import("@/lib/prisma")
    const childWeblet = await prisma.weblet.findUnique({
        where: { id: childWebletId },
        select: { capabilities: true },
    })

    let tools = getToolsFromCapabilities(childWeblet?.capabilities, childWebletId)

    // Resolve child's own compositions (nested composability)
    const childCompositions = await resolveCompositions(childWebletId)
    if (childCompositions.length > 0) {
        const childTools = createChildWebletTools(childCompositions, depth)
        tools = { ...tools, ...childTools }
    }

    const modelId = activeVersion.model || "anthropic/claude-3.5-sonnet"

    // Execute using generateText (synchronous — parent is waiting)
    const result = await generateText({
        model: getLanguageModel(modelId),
        system: activeVersion.prompt,
        messages: [{ role: "user", content: message }],
        tools,
        stopWhen: stepCountIs(5), // Allow tool use within the child
    })

    return result.text || "No response from child weblet"
}
