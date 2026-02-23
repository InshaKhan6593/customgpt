import { webSearchTool } from "./web-search"
import { codeInterpreterTool } from "./code-interpreter"
import { imageGenerationTool } from "./image-generation"
import { fileSearchTool } from "./file-search"

/**
 * Maps the capability keys from Weblet configuration into actual Vercel AI SDK tools.
 */
export function getToolsFromCapabilities(capabilities: any) {
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
    tools.imageGeneration = imageGenerationTool
  }

  if (capabilities.fileSearch) {
    tools.fileSearch = fileSearchTool
  }

  return tools
}
