/**
 * Text Chunking — Split extracted text into overlapping chunks
 *
 * Per segment-04 spec:
 * - Chunk size: ~500 tokens (~2000 characters)  
 * - Overlap: ~50 tokens (~200 characters) between chunks
 * - This ensures RAG retrieval captures complete thoughts
 */

const CHUNK_SIZE = 2000    // ~500 tokens (rough estimate: 1 token ≈ 4 chars)
const CHUNK_OVERLAP = 200  // ~50 tokens overlap

/**
 * Split text into overlapping chunks suitable for embedding.
 * Uses a simple character-based approach with sentence boundary awareness.
 */
export function chunkText(text: string): string[] {
  // Clean up the text
  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (cleanedText.length <= CHUNK_SIZE) {
    return [cleanedText]
  }

  const chunks: string[] = []
  let start = 0

  while (start < cleanedText.length) {
    let end = start + CHUNK_SIZE

    // If we're not at the end, try to break at a sentence boundary
    if (end < cleanedText.length) {
      // Look for the last sentence-ending punctuation within the chunk
      const searchWindow = cleanedText.substring(start, end)
      const lastPeriod = Math.max(
        searchWindow.lastIndexOf(". "),
        searchWindow.lastIndexOf(".\n"),
        searchWindow.lastIndexOf("! "),
        searchWindow.lastIndexOf("? "),
        searchWindow.lastIndexOf("?\n"),
      )

      if (lastPeriod > CHUNK_SIZE * 0.5) {
        // Found a good sentence boundary in the latter half
        end = start + lastPeriod + 1
      }
    } else {
      end = cleanedText.length
    }

    const chunk = cleanedText.substring(start, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Move forward with overlap
    start = end - CHUNK_OVERLAP
    if (start >= cleanedText.length) break
  }

  return chunks
}
