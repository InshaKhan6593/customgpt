import { z } from "zod"

export const imageGenerationTool = (modelId: string = "dall-e-3") => ({
  description: `Invoke an image generation model to create a custom visual image based on a text prompt.

WHEN TO USE:
- The user explicitly asks to 'generate an image', 'draw', 'create a picture', or similar visual requests.
- Do NOT use this tool if the user is asking you to return code for a UI component or an SVG.

HOW IT WORKS:
- You must craft a highly detailed, descriptive prompt.
- The tool returns a URL to the successfully generated image.
- REQUIRED: When the tool returns the image URL, you MUST embed it in your final markdown response to the user using standard markdown image syntax: ![Generated Image Description](<returned_url>)`,
  inputSchema: z.object({
    prompt: z.string().describe("A highly detailed, descriptive prompt for the image generator. You MUST specify the style (e.g., photorealistic, watercolor, 3D render), lighting, composition, time period, and color scheme. Do not request text rendering inside the image. Be extremely specific."),
  }),
  execute: async ({ prompt }: { prompt: string }) => {
    // If it's an OpenRouter model, use OpenRouter API. If it's DALL-E, use OpenAI.
    const isOpenRouter = modelId !== "dall-e-3";
    const apiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    const apiUrl = isOpenRouter 
      ? "https://openrouter.ai/api/v1/chat/completions" 
      : "https://api.openai.com/v1/images/generations";

    if (!apiKey) {
      console.warn(`${isOpenRouter ? "OPENROUTER" : "OPENAI"}_API_KEY not found. Returning stubbed image.`)
      return { url: "https://via.placeholder.com/1024x1024?text=Missing+API+Key" }
    }

    try {
      let body: any = {};
      
      if (isOpenRouter) {
        body = {
          model: modelId,
          messages: [{ role: "user", content: prompt }]
        }
      } else {
        body = {
          model: modelId,
          prompt,
          n: 1,
          size: "1024x1024"
        }
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          ...(isOpenRouter ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            "X-Title": "WebletGPT"
          } : {})
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        throw new Error(`${isOpenRouter ? "OpenRouter" : "OpenAI"} API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (isOpenRouter) {
        // OpenRouter returns standard chat completion format, and some models include image URLs in the content or as a base64 string
        // Depending on the model, we may need to parse it. Let's aim to return the text block that contains the markdown image
        return { url: data.choices[0]?.message?.content || "https://via.placeholder.com/1024x1024?text=Image+Generation+Failed" }
      } else {
        return { url: data.data[0].url }
      }
    } catch (error: any) {
      return { error: `Failed to generate image: ${error.message}` }
    }
  }
})
