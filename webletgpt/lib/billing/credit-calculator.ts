import { CREDIT_MULTIPLIERS } from './pricing';

export { CREDIT_MULTIPLIERS } from './pricing';

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
