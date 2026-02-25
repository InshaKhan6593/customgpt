/**
 * Embedding Generation — Convert text chunks to vector embeddings
 *
 * Supports two providers:
 * - "ollama" (FREE, local) — Uses nomic-embed-text-v2-moe (768 dimensions)
 * - "openai" (paid, cloud) — Uses text-embedding-3-small (1536 dimensions)
 *
 * Set EMBEDDING_PROVIDER in .env to switch between them.
 */

const PROVIDER = process.env.EMBEDDING_PROVIDER || "ollama"

// Provider configs
const OPENAI_MODEL = "text-embedding-3-small"
const OPENAI_DIMENSIONS = 1536
const OPENAI_BATCH_SIZE = 100

const OLLAMA_MODEL = "nomic-embed-text-v2-moe:latest"
const OLLAMA_DIMENSIONS = 768
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434"

/**
 * Returns the embedding dimensions for the current provider.
 * Used by process.ts to format the vector string correctly.
 */
export function getEmbeddingDimensions(): number {
  return PROVIDER === "openai" ? OPENAI_DIMENSIONS : OLLAMA_DIMENSIONS
}

/**
 * Generate embeddings via Ollama (local, free).
 * Ollama's /api/embed endpoint supports batch input.
 */
async function generateOllamaEmbeddings(chunks: string[]): Promise<number[][]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      input: chunks,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama embed API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.embeddings
}

/**
 * Generate embeddings via OpenAI (paid, cloud).
 * Processes in batches of 100 for efficiency.
 */
async function generateOpenAIEmbeddings(chunks: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai")
  }

  const allEmbeddings: number[][] = []

  for (let i = 0; i < chunks.length; i += OPENAI_BATCH_SIZE) {
    const batch = chunks.slice(i, i + OPENAI_BATCH_SIZE)

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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
  }

  return allEmbeddings
}

/**
 * Generate vector embeddings for an array of text chunks.
 * Automatically uses the provider specified in EMBEDDING_PROVIDER env var.
 */
export async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  console.log(`Generating embeddings for ${chunks.length} chunks using ${PROVIDER}...`)

  if (PROVIDER === "openai") {
    return generateOpenAIEmbeddings(chunks)
  } else {
    return generateOllamaEmbeddings(chunks)
  }
}

/**
 * Generate a single embedding for a search query.
 * Used during RAG search to embed the user's question.
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const embeddings = await generateEmbeddings([query])
  return embeddings[0]
}
