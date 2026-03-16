import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAI } from "@ai-sdk/openai"

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Returns an AI SDK LanguageModel using OpenRouter as the gateway.
 *
 * Uses OpenRouter's native `models` fallback: if the primary model returns
 * a server error, OpenRouter tries the next model server-side (no extra
 * round trip). `provider.allow_fallbacks` lets OpenRouter also try different
 * infrastructure providers for each model. Combined with maxRetries: 2 in
 * the streamText call, total worst-case is 3 attempts × 3 models = robust recovery.
 */
export function getLanguageModel(modelId: string) {
  return openrouter(modelId, {
    models: [
      modelId,
      "google/gemini-2.5-flash",
      "anthropic/claude-3.5-sonnet",
    ].filter((m, i, arr) => arr.indexOf(m) === i),  // deduplicate if modelId matches a fallback
    provider: { allow_fallbacks: true },
  })
}

/**
 * Extracts the base model name from an OpenRouter model ID.
 * e.g., "anthropic/claude-3.5-sonnet" → "claude-3.5-sonnet"
 *       "openai/gpt-4o" → "gpt-4o"
 */
function extractModelName(modelId: string): { provider: string; model: string } {
  const parts = modelId.split("/")
  return {
    provider: parts[0] || "",
    model: parts.slice(1).join("/") || modelId,
  }
}

/**
 * Returns a fallback model if the provider matches a direct SDK.
 * Returns null if no fallback is available for this provider.
 */
export function getFallbackModel(modelId: string) {
  const { provider, model } = extractModelName(modelId)

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return openai(model)
  }

  // No fallback available for other providers (Meta, Google, DeepSeek, etc.)
  return null
}

