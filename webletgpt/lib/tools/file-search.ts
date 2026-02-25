import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { generateQueryEmbedding } from "@/lib/knowledge/embed"

/**
 * File Search Tool — Hybrid RAG (Vector + Full-Text Search + RRF)
 *
 * Mirrors OpenAI's Custom GPT file_search + OpenClaw's approach:
 *
 * Channel 1: Vector similarity search via pgvector (semantic meaning)
 * Channel 2: PostgreSQL full-text search via tsvector/tsquery (exact keywords)
 * Merge: Reciprocal Rank Fusion (RRF) to combine and re-rank both result sets
 *
 * Factory function: accepts webletId to scope searches to the correct Weblet.
 */

const TOP_K_PER_CHANNEL = 10 // Retrieve 10 from each channel
const FINAL_TOP_K = 5 // Return top 5 after RRF merge
const RRF_K = 60 // Standard RRF constant (controls rank smoothing)

/**
 * Reciprocal Rank Fusion — merges ranked lists from multiple retrieval channels.
 * For each document, its fused score = sum(1 / (k + rank_in_channel)).
 * Documents appearing in multiple channels get boosted.
 */
function reciprocalRankFusion(
  rankedLists: Array<Array<{ id: string; content: string; filename: string; score?: number }>>,
  k: number = RRF_K
): Array<{ id: string; content: string; filename: string; fusedScore: number }> {
  const scoreMap = new Map<string, { content: string; filename: string; fusedScore: number }>()

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank]
      const rrfScore = 1 / (k + rank + 1) // +1 because rank is 0-indexed

      if (scoreMap.has(item.id)) {
        // Appeared in another channel too — boost it!
        const existing = scoreMap.get(item.id)!
        existing.fusedScore += rrfScore
      } else {
        scoreMap.set(item.id, {
          content: item.content,
          filename: item.filename,
          fusedScore: rrfScore,
        })
      }
    }
  }

  // Sort by fused score (highest first) and return top K
  return Array.from(scoreMap.entries())
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, FINAL_TOP_K)
}

export const fileSearchTool = (webletId: string) => ({
  description: `Perform a Retrieval-Augmented Generation (RAG) semantic database search over the Weblet's uploaded knowledge base and private documents.

WHEN TO USE:
- ALWAYS USE THIS TOOL FIRST when a user asks about specific domains, company policies, uploaded documents, or niche topics related to this agent's persona.
- Use this tool when the user refers to 'my files', 'the document', or specific proprietary information.

HOW IT WORKS:
- The tool executes a hybrid search: vector similarity + full-text keyword matching across chunked document embeddings.
- Results are merged using Reciprocal Rank Fusion (RRF) for optimal relevance ranking.
- It returns relevant text snippets (chunks) and their source citations.
- Read the returned snippets carefully. Synthesize your final answer based *only* on the provided context.
- If the tool returns empty or irrelevant results, inform the user that the knowledge base does not contain the answer.`,
  inputSchema: z.object({
    query: z.string().describe("A highly optimized semantic search string used for vector matching. Do NOT pass a full conversational question. Extract the core entities, keywords, and concepts from the user's prompt to formulate this query."),
  }),
  execute: async ({ query }: { query: string }) => {
    try {
      // --- Channel 1: Vector similarity search via pgvector ---
      let vectorResults: Array<{ id: string; content: string; filename: string }> = []

      try {
        const queryEmbedding = await generateQueryEmbedding(query)
        const embeddingStr = `[${queryEmbedding.join(",")}]`

        vectorResults = await prisma.$queryRaw`
          SELECT 
            kc.id,
            kc.content,
            kf.filename
          FROM "KnowledgeChunk" kc
          JOIN "KnowledgeFile" kf ON kf.id = kc."knowledgeFileId"
          WHERE kf."webletId" = ${webletId}
            AND kc.embedding IS NOT NULL
          ORDER BY kc.embedding <=> ${embeddingStr}::vector
          LIMIT ${TOP_K_PER_CHANNEL}
        `
      } catch (embedError: any) {
        console.warn("Vector search failed, will rely on full-text only:", embedError.message)
      }

      // --- Channel 2: PostgreSQL full-text search (tsvector/tsquery) ---
      let ftsResults: Array<{ id: string; content: string; filename: string }> = []

      try {
        ftsResults = await prisma.$queryRaw`
          SELECT 
            kc.id,
            kc.content,
            kf.filename
          FROM "KnowledgeChunk" kc
          JOIN "KnowledgeFile" kf ON kf.id = kc."knowledgeFileId"
          WHERE kf."webletId" = ${webletId}
            AND to_tsvector('english', kc.content) @@ plainto_tsquery('english', ${query})
          ORDER BY ts_rank(to_tsvector('english', kc.content), plainto_tsquery('english', ${query})) DESC
          LIMIT ${TOP_K_PER_CHANNEL}
        `
      } catch (ftsError: any) {
        console.warn("Full-text search failed:", ftsError.message)
      }

      // --- Merge via Reciprocal Rank Fusion ---
      const merged = reciprocalRankFusion([vectorResults, ftsResults])

      if (merged.length === 0) {
        return {
          results: [],
          message: "No relevant content found in the knowledge base for this query."
        }
      }

      return {
        results: merged.map(r => ({
          source: r.filename,
          content: r.content,
          relevance: r.fusedScore,
        }))
      }
    } catch (error: any) {
      console.error("File search error:", error)
      return {
        results: [],
        message: `Knowledge base search failed: ${error.message}`
      }
    }
  }
})
