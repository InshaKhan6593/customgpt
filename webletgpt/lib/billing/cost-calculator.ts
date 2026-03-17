import { FALLBACK_MODEL_RATE, MODEL_RATES, TOOL_COSTS_USD } from './pricing'

export function calculateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number,
  toolCalls: Record<string, number> | null | undefined
): number {
  const rate = MODEL_RATES[modelId as keyof typeof MODEL_RATES] ?? FALLBACK_MODEL_RATE
  const tokenCost = (tokensIn / 1_000_000) * rate.in + (tokensOut / 1_000_000) * rate.out

  let toolCost = 0
  if (toolCalls) {
    if (toolCalls.imageGeneration || toolCalls.dalle) toolCost += TOOL_COSTS_USD.imageGeneration
    if (toolCalls.webSearch || toolCalls.tavily) toolCost += TOOL_COSTS_USD.webSearch
    if (toolCalls.e2b || toolCalls.codeInterpreter) toolCost += TOOL_COSTS_USD.codeInterpreter
  }

  return tokenCost + toolCost
}
