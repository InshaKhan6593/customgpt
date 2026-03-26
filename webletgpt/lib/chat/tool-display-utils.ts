/** Friendly display names for built-in capability tools */
const TOOL_DISPLAY_NAMES: Record<string, { label: string; action: string }> = {
  webSearch: { label: "Web Search", action: "Searching the web" },
  codeInterpreter: { label: "Code Interpreter", action: "Running code" },
  imageGeneration: { label: "Image Generation", action: "Generating image" },
  fileSearch: { label: "File Search", action: "Searching files" },
  presentToUser: { label: "Present to User", action: "Presenting artifact" },
}

/** Split camelCase into readable words */
function camelToTitle(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
}

export function formatToolName(name: string): { label: string; action: string } {
  // Built-in capability tools (camelCase)
  if (TOOL_DISPLAY_NAMES[name]) {
    return TOOL_DISPLAY_NAMES[name]
  }

  // MCP tools: mcp_server_toolname
  if (name.startsWith("mcp_")) {
    const withoutPrefix = name.slice(4)
    const firstUnderscore = withoutPrefix.indexOf("_")
    if (firstUnderscore > 0) {
      const server = withoutPrefix.slice(0, firstUnderscore).replace(/_/g, " ")
      const action = withoutPrefix.slice(firstUnderscore + 1).replace(/_/g, " ")
      return {
        label: server.charAt(0).toUpperCase() + server.slice(1),
        action,
      }
    }
    return { label: "MCP", action: withoutPrefix.replace(/_/g, " ") }
  }

  // Composition tools: weblet_slug_name
  if (name.startsWith("weblet_")) {
    const slug = name.slice(7).replace(/_/g, " ")
    return { label: "Weblet", action: slug.charAt(0).toUpperCase() + slug.slice(1) }
  }

  // OpenAPI tools: get_users, post_create_order
  if (/^(get|post|put|patch|delete)_/.test(name)) {
    const firstUnderscore = name.indexOf("_")
    const method = name.slice(0, firstUnderscore).toUpperCase()
    const path = name.slice(firstUnderscore + 1).replace(/_/g, " ")
    return { label: "API", action: `${method} ${path}` }
  }

  // Fallback: handle both camelCase and snake_case
  if (name.includes("_")) {
    const words = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    return { label: words, action: "" }
  }

  return { label: camelToTitle(name), action: "" }
}

/** Vercel-style action description from tool name */
export function getActionDescription(label: string, action: string): string {
  if (!action) return `Used ${label}`
  return `Used ${label}: ${action}`
}
