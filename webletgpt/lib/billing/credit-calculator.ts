export const CREDIT_MULTIPLIERS = {
  base: 1,            // Simple chat, no tools
  fileSearch: 2,      // Knowledge search (rag)
  rag: 2,
  webSearch: 3,       // Web search (tavily)
  tavily: 3,
  codeInterpreter: 3, // Code interpreter (e2b)
  e2b: 3,
  imageGeneration: 5, // Image generation (dalle)
  dalle: 5,
  custom_action: 2,   // Custom HTTP action
  mcp: 2,             // MCP server tool call
} as const;

export function calculateCredits(toolCalls?: Record<string, number> | null): number {
  if (!toolCalls || Object.keys(toolCalls).length === 0) {
    return CREDIT_MULTIPLIERS.base; // No tools = 1 credit
  }

  let credits = 0;
  for (const [tool, count] of Object.entries(toolCalls)) {
    // Check for prefix-based tool names first (MCP tools, composition tools)
    let multiplier: number;
    if (tool.startsWith("mcp_")) {
      multiplier = CREDIT_MULTIPLIERS.mcp;
    } else if (tool.startsWith("weblet_")) {
      multiplier = CREDIT_MULTIPLIERS.mcp; // Composition calls same cost as MCP
    } else {
      const key = tool as keyof typeof CREDIT_MULTIPLIERS;
      multiplier = CREDIT_MULTIPLIERS[key] || CREDIT_MULTIPLIERS.base;
    }
    credits += multiplier * count;
  }
  return Math.max(credits, 1); // Minimum 1 credit
}
