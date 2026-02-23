/**
 * Embedding Generation — Convert text chunks to vector embeddings
 *
 * Per segment-04 spec:
 * - Model: OpenAI text-embedding-3-small  
 * - Dimensions: 1536
 * - Batch processing for efficiency
 */

const EMBEDDING_MODEL = "text-embedding-3-small"
const BATCH_SIZE = 100 // OpenAI supports up to 2048, but 100 is safe

/**
 * Generate vector embeddings for an array of text chunks.
 * Returns an array of number arrays (one embedding per chunk).
 */
export async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.warn("OPENAI_API_KEY not found. Returning zero embeddings.")
    return chunks.map(() => new Array(1536).fill(0))
  }

  const allEmbeddings: number[][] = []

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)

    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: batch,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI Embedding API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const embeddings = data.data
        .sort((a: any, b: any) => a.index - b.index)
        .map((item: any) => item.embedding)

      allEmbeddings.push(...embeddings)
    } catch (error: any) {
      console.error(`Embedding batch ${i / BATCH_SIZE + 1} failed:`, error)
      throw error
    }
  }

  return allEmbeddings
}

/**
 * Generate a single embedding for a search query.
 * Used during RAG search to embed the user's question.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([query])
  return embeddings[0]
}
