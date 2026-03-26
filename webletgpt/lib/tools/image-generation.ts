import { z } from "zod"
import { storeImage } from "./image-store"

/**
 * Production-grade image generation tool for Weblet capabilities.
 *
 * Flow:
 * 1. LLM calls this tool with a descriptive prompt
 * 2. Tool calls OpenAI (preferred) or OpenRouter to generate the image
 * 3. Base64 result is stored in the in-memory image store
 * 4. Only a short `/api/image/{id}` URL is returned to the LLM context
 * 5. LLM embeds the URL in its markdown response: ![desc](/api/image/{id})
 * 6. Chat UI renders the image inline via the serve route
 *
 * This prevents base64 blobs from bloating conversation context
 * (which previously caused "context limit reached" errors).
 */

const FETCH_TIMEOUT_MS = 60_000 // 60s — image generation can be slow

/**
 * Models that ONLY output images (no text).
 * These require modalities: ["image"] on OpenRouter.
 * Models that output both text+image (e.g. Gemini) use ["image", "text"].
 */
const IMAGE_ONLY_MODEL_PREFIXES = [
  "sourceful/",
  "black-forest-labs/",
] as const

function getOpenRouterModalities(modelId: string): string[] {
  const isImageOnly = IMAGE_ONLY_MODEL_PREFIXES.some(prefix => modelId.startsWith(prefix))
  return isImageOnly ? ["image"] : ["image", "text"]
}

export const imageGenerationTool = (modelId: string = "dall-e-3") => ({
  description: `Invoke an image generation model to create a custom visual image based on a text prompt.

WHEN TO USE:
- The user explicitly asks to 'generate an image', 'draw', 'create a picture', or similar visual requests.
- Do NOT use this tool if the user is asking you to return code for a UI component or an SVG.

HOW IT WORKS:
- You must craft a highly detailed, descriptive prompt.
- The tool will generate the image and return a URL.
- Do NOT write markdown image syntax like ![](url) — use presentToUser if available.`,
  toModelOutput: ({ output: result }: { toolCallId: string; input: unknown; output: any }) => {
    if (result?.error) return { type: 'text' as const, value: result.error }
    const url = result?.url || ''
    return { type: 'text' as const, value: `Image generated successfully. Call presentToUser with type "image" and url "${url}" to display it. Do NOT embed the URL in markdown.` }
  },
  inputSchema: z.object({
    prompt: z.string().describe("A highly detailed, descriptive prompt for the image generator. You MUST specify the style (e.g., photorealistic, watercolor, 3D render), lighting, composition, time period, and color scheme. Do not request text rendering inside the image. Be extremely specific."),
  }),
  execute: async ({ prompt }: { prompt: string }) => {
    if (!prompt || prompt.trim().length === 0) {
      return { error: "Prompt cannot be empty." }
    }

    try {
      // Prefer OpenAI direct when key is available (reliable, matches CustomGPT behavior)
      if (process.env.OPENAI_API_KEY) {
        const effectiveModel = modelId === "dall-e-3" || modelId.includes("dall-e") ? modelId : "dall-e-3"
        return await generateWithOpenAI(prompt, effectiveModel)
      }

      // Fallback to OpenRouter
      if (process.env.OPENROUTER_API_KEY) {
        return await generateWithOpenRouter(prompt, modelId)
      }

      return { error: "No image generation API key configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY." }
    } catch (error: any) {
      console.error("[ImageGen] Unexpected error:", error)
      return { error: `Image generation failed unexpectedly: ${error.message}` }
    }
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}

function buildImageUrl(imageId: string): string {
  return `${getAppUrl()}/api/image/${imageId}`
}

/**
 * Store base64 image data and return the short serve URL.
 * Strips `data:image/...;base64,` prefix if present.
 */
function storeAndReturnUrl(raw: string, mimeType: string = "image/png"): { url: string } {
  const cleaned = raw.replace(/^data:image\/[a-z+]+;base64,/i, "")
  const imageId = storeImage(cleaned, mimeType)
  return { url: buildImageUrl(imageId) }
}

// ---------------------------------------------------------------------------
// OpenAI /v1/images/generations (DALL-E 3 / gpt-image-1)
// ---------------------------------------------------------------------------
async function generateWithOpenAI(prompt: string, modelId: string): Promise<{ url: string } | { error: string }> {
  const apiKey = process.env.OPENAI_API_KEY!

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const err = await response.text().catch(() => "Unknown error")
      console.error(`[ImageGen] OpenAI API ${response.status}:`, err)

      // surface user-friendly messages for common errors
      if (response.status === 429) {
        return { error: "Image generation rate limit exceeded. Please try again in a moment." }
      }
      if (response.status === 400 && err.includes("safety")) {
        return { error: "Your prompt was flagged by the safety system. Please try a different description." }
      }

      throw new Error(`OpenAI API ${response.status}: ${err.slice(0, 200)}`)
    }

    const data = await response.json()
    const b64 = data.data?.[0]?.b64_json

    if (b64) {
      return storeAndReturnUrl(b64, "image/png")
    }

    // Some models return a URL instead of b64 — proxy it for consistency
    const directUrl = data.data?.[0]?.url
    if (directUrl) {
      // Fetch and store the image so it's served from our domain
      try {
        const imgResponse = await fetch(directUrl)
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
          const imgB64 = imgBuffer.toString("base64")
          const contentType = imgResponse.headers.get("content-type") || "image/png"
          return storeAndReturnUrl(imgB64, contentType)
        }
      } catch {
        // If proxying fails, return the direct URL as fallback
      }
      return { url: directUrl }
    }

    return { error: "Image generation completed but no image was produced. Please try again." }
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { error: "Image generation timed out. Please try again with a simpler prompt." }
    }
    return { error: `Image generation failed: ${error.message}` }
  }
}

// ---------------------------------------------------------------------------
// OpenRouter /api/v1/chat/completions with modalities: ["image", "text"]
// ---------------------------------------------------------------------------
async function generateWithOpenRouter(prompt: string, modelId: string): Promise<{ url: string } | { error: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY!

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": getAppUrl(),
        "X-Title": "WebletGPT",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        modalities: getOpenRouterModalities(modelId),
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const err = await response.text().catch(() => "Unknown error")
      console.error(`[ImageGen] OpenRouter API ${response.status}:`, err)

      if (response.status === 429) {
        return { error: "Image generation rate limit exceeded. Please try again in a moment." }
      }

      throw new Error(`OpenRouter API ${response.status}: ${err.slice(0, 200)}`)
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message

    // Case 1: OpenRouter returns base64 in images array
    const imageData = message?.images?.[0]
    if (imageData) {
      const b64 = imageData.image_url?.url || imageData.b64_json || (typeof imageData === "string" ? imageData : null)
      if (b64 && typeof b64 === "string") {
        return storeAndReturnUrl(b64, "image/png")
      }
    }

    // Case 2: Content itself contains a base64 data URL
    const content = message?.content || ""
    const dataUrlMatch = content.match(/data:image\/([a-z+]+);base64,([A-Za-z0-9+/=]+)/i)
    if (dataUrlMatch) {
      const mimeType = `image/${dataUrlMatch[1]}`
      return storeAndReturnUrl(dataUrlMatch[2], mimeType)
    }

    // Case 3: Content contains an HTTP image URL
    const urlMatch = content.match(/(https?:\/\/[^\s)]+\.(?:png|jpg|jpeg|webp|gif)[^\s)]*)/i)
    if (urlMatch?.[1]) {
      return { url: urlMatch[1] }
    }

    // Case 4: Markdown image syntax
    const markdownMatch = content.match(/!\[.*?\]\((.*?)\)/)
    if (markdownMatch?.[1]) {
      return { url: markdownMatch[1] }
    }

    console.warn("[ImageGen] OpenRouter returned no recognizable image format:", JSON.stringify(message).slice(0, 500))
    return { error: "Image generation completed but no image was returned. Try configuring an OpenAI API key for more reliable results." }
  } catch (error: any) {
    if (error.name === "AbortError") {
      return { error: "Image generation timed out. Please try again with a simpler prompt." }
    }
    return { error: `Image generation failed: ${error.message}` }
  }
}
