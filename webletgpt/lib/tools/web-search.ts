import { z } from "zod"

export const webSearchTool = {
  description: `Use this tool to search the internet for real-time information, current events, or facts you do not know. 

WHEN TO USE:
- The user asks about recent events, news, or timely information (e.g., weather, stocks, recent sports scores).
- The user asks a factual question where your internal knowledge might be outdated.
- Do NOT use this tool for general knowledge you already possess unless you need to verify it.

HOW IT WORKS:
- The tool performs a semantic web search and returns snippets from top relevant websites.
- Read the result snippets carefully and synthesize the final answer. Provide citations or links if asked.`,
  inputSchema: z.object({
    query: z.string().describe("A concise, targeted search query consisting of keywords. Optimize this query for a search engine, not a conversational question. Keep it under 50 characters for best results."),
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
