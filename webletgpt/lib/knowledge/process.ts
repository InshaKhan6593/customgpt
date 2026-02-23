/**
 * Knowledge Processing Pipeline — Main Orchestrator
 * 
 * Handles the full knowledge file processing flow:
 * 1. Upload → store in Vercel Blob
 * 2. Extract → parse text from PDF/DOCX/TXT/CSV/MD via LlamaParse
 * 3. Chunk → split into 500-token chunks with 50-token overlap
 * 4. Embed → generate vector embeddings via OpenAI text-embedding-3-small
 * 5. Store → save chunks + embeddings to KnowledgeChunk table (pgvector)
 */

import { prisma } from "@/lib/prisma"
import { extractText } from "./extract"
import { chunkText } from "./chunk"
import { generateEmbeddings } from "./embed"

interface ProcessingProgress {
  stage: "uploading" | "extracting" | "chunking" | "embedding" | "done"
  progress: number
  message: string
}

type ProgressCallback = (progress: ProcessingProgress) => void

/**
 * Process a knowledge file end-to-end: extract → chunk → embed → store
 */
export async function processKnowledgeFile(
  knowledgeFileId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  onProgress?: ProgressCallback
) {
  try {
    // Step 1: Extract text from the file
    onProgress?.({ stage: "extracting", progress: 20, message: "Extracting text..." })
    const text = await extractText(fileBuffer, filename, mimeType)

    if (!text || text.trim().length === 0) {
      throw new Error("No text could be extracted from this file.")
    }

    // Step 2: Chunk the text
    onProgress?.({ stage: "chunking", progress: 40, message: "Chunking text..." })
    const chunks = chunkText(text)

    // Step 3: Generate embeddings for each chunk
    onProgress?.({ stage: "embedding", progress: 60, message: `Generating embeddings for ${chunks.length} chunks...` })
    const embeddings = await generateEmbeddings(chunks)

    // Step 4: Store chunks + embeddings in the database
    onProgress?.({ stage: "embedding", progress: 80, message: "Storing in database..." })
    
    // Use raw SQL for pgvector embedding insertion
    for (let i = 0; i < chunks.length; i++) {
      const embedding = embeddings[i]
      const content = chunks[i]

      await prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk" (id, "knowledgeFileId", content, embedding)
        VALUES (gen_random_uuid(), ${knowledgeFileId}, ${content}, ${embedding}::vector)
      `
    }

    onProgress?.({ stage: "done", progress: 100, message: `Done (${chunks.length} chunks created)` })

    return { success: true, chunkCount: chunks.length }
  } catch (error: any) {
    console.error("Knowledge processing error:", error)
    throw error
  }
}
