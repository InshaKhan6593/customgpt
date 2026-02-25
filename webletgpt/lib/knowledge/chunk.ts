/**
 * Text Chunking — Smart, structure-aware chunking
 *
 * Strategy:
 * 1. First try to split by markdown headers (## Section)
 * 2. If a section is still too big, split by paragraphs (double newline)
 * 3. If a paragraph is still too big, split by sentences
 * 4. Each chunk keeps its section header for context
 *
 * This preserves document structure so each chunk contains
 * one complete legal section / topic instead of cutting mid-paragraph.
 */

const MAX_CHUNK_SIZE = 2000   // ~500 tokens
const CHUNK_OVERLAP = 200     // ~50 tokens overlap between chunks

/**
 * Split text into overlapping, structure-aware chunks suitable for embedding.
 */
export function chunkText(text: string): string[] {
  const cleanedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (!cleanedText || cleanedText.length === 0) {
    return []
  }

  // If text fits in one chunk, return as-is
  if (cleanedText.length <= MAX_CHUNK_SIZE) {
    return [cleanedText]
  }

  // Step 1: Split by markdown headers (## or ### etc.)
  const sections = splitByHeaders(cleanedText)

  // Step 2: For each section, ensure it fits within MAX_CHUNK_SIZE
  const chunks: string[] = []
  for (const section of sections) {
    if (section.length <= MAX_CHUNK_SIZE) {
      chunks.push(section)
    } else {
      // Section too big — split by paragraphs
      const subChunks = splitByParagraphs(section)
      chunks.push(...subChunks)
    }
  }

  return chunks
}

/**
 * Split text by markdown headers (##, ###, etc.)
 * Each section includes its header for context.
 */
function splitByHeaders(text: string): string[] {
  // Match lines starting with # (any level)
  const headerRegex = /^(#{1,6}\s+.+)$/gm
  const sections: string[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  const matches: Array<{ index: number; header: string }> = []
  while ((match = headerRegex.exec(text)) !== null) {
    matches.push({ index: match.index, header: match[1] })
  }

  if (matches.length === 0) {
    // No headers found — treat entire text as one section
    return splitByParagraphs(text)
  }

  // Content before first header (if any)
  if (matches[0].index > 0) {
    const preamble = text.substring(0, matches[0].index).trim()
    if (preamble.length > 0) {
      sections.push(preamble)
    }
  }

  // Each section = header + content until next header
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length
    const section = text.substring(start, end).trim()
    if (section.length > 0) {
      sections.push(section)
    }
  }

  return sections
}

/**
 * Split a long section by paragraph boundaries (double newlines).
 * If a paragraph is still too long, falls back to sentence splitting.
 */
function splitByParagraphs(text: string): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let currentChunk = ""

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // If adding this paragraph would exceed the limit
    if (currentChunk.length + trimmed.length + 2 > MAX_CHUNK_SIZE) {
      // Save current chunk if it has content
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
      }

      // If the paragraph itself is too big, split by sentences
      if (trimmed.length > MAX_CHUNK_SIZE) {
        chunks.push(...splitBySentences(trimmed))
        currentChunk = ""
      } else {
        currentChunk = trimmed
      }
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

/**
 * Last resort: split very long text by sentences.
 */
function splitBySentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 > MAX_CHUNK_SIZE) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
      }
      currentChunk = sentence
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }

  return chunks.length > 0 ? chunks : [text.substring(0, MAX_CHUNK_SIZE)]
}
