import { webSearchTool } from "./web-search"
import { codeInterpreterTool } from "./code-interpreter"
import { imageGenerationTool } from "./image-generation"
import { fileSearchTool } from "./file-search"

/**
 * Maps the capability keys from Weblet configuration into actual Vercel AI SDK tools.
 * @param capabilities - The Weblet's capability flags (webSearch, imageGen, fileSearch, etc.)
 * @param webletId - The Weblet ID, required for scoping file search to the correct knowledge base
 */
export function getToolsFromCapabilities(capabilities: any, webletId?: string) {
  const tools: Record<string, any> = {}

  if (!capabilities) return tools

  // Check each capability flag and attach the corresponding tool
  if (capabilities.webSearch) {
    tools.webSearch = webSearchTool
  }

  if (capabilities.codeInterpreter) {
    tools.codeInterpreter = codeInterpreterTool
  }

  if (capabilities.imageGen) {
    tools.imageGeneration = imageGenerationTool(capabilities.imageGenModel || "google/gemini-3.1-flash-image-preview")
  }

  if (capabilities.fileSearch && webletId) {
    tools.fileSearch = fileSearchTool(webletId)
  }

  return tools
}
