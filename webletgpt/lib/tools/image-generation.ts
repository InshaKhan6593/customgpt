import { z } from "zod"

export const imageGenerationTool = {
  description: "Generate an image from a text description using DALL-E.",
  inputSchema: z.object({
    prompt: z.string().describe("A highly detailed prompt describing the image to generate."),
  }),
  execute: async ({ prompt }: any) => {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.warn("OPENAI_API_KEY not found. Returning stubbed image.")
      return { url: "https://via.placeholder.com/1024x1024?text=Missing+OpenAI+Key" }
    }

    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024"
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      return { url: data.data[0].url }
    } catch (error: any) {
      return { error: `Failed to generate image: ${error.message}` }
    }
  }
}
