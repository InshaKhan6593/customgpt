import { webSearchTool } from "./web-search"
import { createCodeInterpreterTool, codeInterpreterTool } from "./code-interpreter"
import { imageGenerationTool } from "./image-generation"
import { fileSearchTool } from "./file-search"

/**
 * Maps capability flags from a Weblet config into AI SDK tool definitions.
 *
 * @param capabilities  - The Weblet's capability flags (webSearch, codeInterpreter, etc.)
 * @param webletId      - Required for scoping fileSearch to the correct knowledge base
 * @param persistentSandbox - Optional E2B Sandbox instance for child-weblet execution.
 *                            When provided, codeInterpreter reuses this sandbox across
 *                            all calls (state, packages, and files persist between calls).
 *                            When omitted, a fresh sandbox is created per call.
 */
export function getToolsFromCapabilities(
    capabilities: any,
    webletId?: string,
    persistentSandbox?: any
) {
    const tools: Record<string, any> = {}

    if (!capabilities) return tools

    if (capabilities.webSearch) {
        tools.webSearch = webSearchTool
    }

    if (capabilities.codeInterpreter) {
        // Use a persistent sandbox (shared state) when executing inside a child weblet,
        // or the default stateless tool for direct parent-weblet chat.
        tools.codeInterpreter = persistentSandbox
            ? createCodeInterpreterTool(persistentSandbox)
            : codeInterpreterTool
    }

    if (capabilities.imageGen) {
        tools.imageGeneration = imageGenerationTool(
            capabilities.imageGenModel || "google/gemini-3.1-flash-image-preview"
        )
    }

    if (capabilities.fileSearch && webletId) {
        tools.fileSearch = fileSearchTool(webletId)
    }

    return tools
}
