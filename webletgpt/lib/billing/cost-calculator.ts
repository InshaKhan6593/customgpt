// lib/billing/cost-calculator.ts

/**
 * Model-specific token rates in USD per 1M tokens.
 * Rates from provider pricing pages (updated 2026-03).
 * Unknown models fall back to Claude 3.5 Sonnet rates (conservative).
 */
const MODEL_RATES: Record<string, { in: number; out: number }> = {
  // Anthropic
  "anthropic/claude-3.5-sonnet":        { in: 3.0,   out: 15.0  },
  "anthropic/claude-3.5-haiku":         { in: 0.8,   out: 4.0   },
  "anthropic/claude-3-haiku":           { in: 0.25,  out: 1.25  },
  "anthropic/claude-3-opus":            { in: 15.0,  out: 75.0  },
  "anthropic/claude-opus-4":            { in: 15.0,  out: 75.0  },
  "anthropic/claude-opus-4-6":          { in: 15.0,  out: 75.0  },
  "anthropic/claude-sonnet-4-6":        { in: 3.0,   out: 15.0  },
  "anthropic/claude-haiku-4-5":         { in: 0.8,   out: 4.0   },
  // OpenAI
  "openai/gpt-4o":                      { in: 5.0,   out: 15.0  },
  "openai/gpt-4o-mini":                 { in: 0.15,  out: 0.6   },
  "openai/gpt-4-turbo":                 { in: 10.0,  out: 30.0  },
  "openai/o1":                          { in: 15.0,  out: 60.0  },
  "openai/o1-mini":                     { in: 3.0,   out: 12.0  },
  "openai/o3-mini":                     { in: 1.1,   out: 4.4   },
  // Google
  "google/gemini-2.5-flash":            { in: 0.15,  out: 0.6   },
  "google/gemini-2.5-flash-lite":       { in: 0.075, out: 0.3   },
  "google/gemini-2.0-flash":            { in: 0.1,   out: 0.4   },
  "google/gemini-2.0-flash-001":        { in: 0.1,   out: 0.4   },
  "google/gemini-1.5-pro":              { in: 1.25,  out: 5.0   },
  "google/gemini-1.5-flash":            { in: 0.075, out: 0.3   },
  // Meta Llama (via OpenRouter)
  "meta-llama/llama-3.3-70b-instruct":  { in: 0.2,   out: 0.6   },
  "meta-llama/llama-3.1-70b-instruct":  { in: 0.2,   out: 0.6   },
  "meta-llama/llama-3.1-8b-instruct":   { in: 0.05,  out: 0.05  },
  "meta-llama/llama-3.2-3b-instruct":   { in: 0.015, out: 0.025 },
  // Mistral
  "mistral/mistral-large":              { in: 8.0,   out: 24.0  },
  "mistral/mistral-small":              { in: 0.2,   out: 0.6   },
  "mistral/mixtral-8x7b-instruct":      { in: 0.24,  out: 0.24  },
  // DeepSeek
  "deepseek/deepseek-chat":             { in: 0.14,  out: 0.28  },
  "deepseek/deepseek-r1":               { in: 0.55,  out: 2.19  },
}

/** Fallback rate for unknown models — conservative (Claude 3.5 Sonnet) */
const FALLBACK_RATE = { in: 3.0, out: 15.0 }

export function calculateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number,
  toolCalls: Record<string, number> | null | undefined
): number {
  const rate = MODEL_RATES[modelId] ?? FALLBACK_RATE
  const tokenCost = (tokensIn / 1_000_000) * rate.in + (tokensOut / 1_000_000) * rate.out

  let toolCost = 0
  if (toolCalls) {
    if (toolCalls.imageGeneration || toolCalls.dalle) toolCost += 0.04
    if (toolCalls.webSearch || toolCalls.tavily) toolCost += 0.01
    if (toolCalls.e2b || toolCalls.codeInterpreter) toolCost += 0.02
  }

  return tokenCost + toolCost
}
