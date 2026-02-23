import { z } from "zod"

export const webSearchTool = {
  description: "Search the web for current events, news, and factual information.",
  inputSchema: z.object({
    query: z.string().describe("The search query to look up on the web."),
  }),
  execute: async ({ query }: any) => {
    const apiKey = process.env.TAVILY_API_KEY

    // Fallback if no API key is provided during testing
    if (!apiKey) {
      console.warn("TAVILY_API_KEY not found. Returning stubbed search results.")
      return {
        results: [
          { title: "Stubbed Result 1", url: "https://example.com/1", content: `Simulated search result for: ${query}` }
        ]
      }
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "basic",
          include_answer: false,
          max_results: 5,
        })
      })

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`)
      }

      const data = await response.json()
      return {
        results: data.results.map((r: any) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        }))
      }
    } catch (error: any) {
      return { error: `Failed to search the web: ${error.message}` }
    }
  }
}
