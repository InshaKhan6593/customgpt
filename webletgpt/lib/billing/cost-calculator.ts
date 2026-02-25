// lib/billing/cost-calculator.ts

export function calculateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number,
  toolCalls: Record<string, number> | null | undefined
): number {
  // Claude 3.5 Sonnet: ~$3/1M in, $15/1M out
  const inCost = (tokensIn / 1_000_000) * 3.0;
  const outCost = (tokensOut / 1_000_000) * 15.0;
  
  let toolCost = 0;
  if (toolCalls) {
    if (toolCalls.imageGeneration || toolCalls.dalle) toolCost += 0.04;
    // Tavily cost per search
    if (toolCalls.webSearch || toolCalls.tavily) toolCost += 0.01;
    // E2B / other custom costs can be scaled here
    if (toolCalls.e2b || toolCalls.codeInterpreter) toolCost += 0.02;
  }
  
  return inCost + outCost + toolCost;
}
