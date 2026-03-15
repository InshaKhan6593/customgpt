import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { createOpenAI } from "@ai-sdk/openai"

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Returns an AI SDK LanguageModel using OpenRouter as the primary gateway.
 * 
 * Per Segment 05 spec (Step 5 — LLM Fallback Strategy):
 * OpenRouter is the primary gateway. If unavailable, extract the provider
 * from the model ID and fall back to direct Anthropic/OpenAI SDKs.
 */
export function getLanguageModel(modelId: string) {
  // response-healing was enabled to fix malformed tool calls, but it buffers
  // the stream server-side causing visible 1-3s pauses mid-response while it
  // detects whether a tool call is being generated. Disabling it eliminates
  // the buffering — modern models (Claude 3.5+, GPT-4o, Llama 3.3) rarely
  // produce malformed tool calls. If a specific model breaks, add it to a
  // per-model allowlist rather than enabling it globally.
  return openrouter(modelId)
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

