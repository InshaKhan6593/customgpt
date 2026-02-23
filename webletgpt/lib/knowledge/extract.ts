/**
 * Text Extraction — Parse text from uploaded documents
 *
 * Supports: PDF, DOCX, TXT, CSV, MD
 * Uses LlamaParse API for PDF/DOCX to prevent Vercel serverless OOM on large files.
 * Falls back to direct text reading for TXT, CSV, MD.
 */

/**
 * Extract plain text from a file buffer based on its MIME type.
 */
export async function extractText(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  // Plain text formats — read directly
  if (
    mimeType === "text/plain" ||
    mimeType === "text/csv" ||
    mimeType === "text/markdown" ||
    filename.endsWith(".md") ||
    filename.endsWith(".txt") ||
    filename.endsWith(".csv")
  ) {
    return fileBuffer.toString("utf-8")
  }

  // PDF and DOCX — use LlamaParse for reliable extraction
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.endsWith(".pdf") ||
    filename.endsWith(".docx")
  ) {
    return extractWithLlamaParse(fileBuffer, filename)
  }

  throw new Error(`Unsupported file type: ${mimeType} (${filename})`)
}

/**
 * Extract text using LlamaParse API.
 * Prevents OOM crashes on Vercel serverless by offloading to external service.
 */
async function extractWithLlamaParse(fileBuffer: Buffer, filename: string): Promise<string> {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY

  if (!apiKey) {
    console.warn("LLAMA_CLOUD_API_KEY not found. Returning empty extraction.")
    return `[Text extraction requires LLAMA_CLOUD_API_KEY. File: ${filename}]`
  }

  try {
    // Upload file to LlamaParse
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(fileBuffer)])
    formData.append("file", blob, filename)

    const uploadResponse = await fetch("https://api.cloud.llamaindex.ai/api/parsing/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!uploadResponse.ok) {
      throw new Error(`LlamaParse upload failed: ${uploadResponse.status}`)
    }

    const { id: jobId } = await uploadResponse.json()

    // Poll for completion (max 60 seconds)
    let result = null
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))

      const statusResponse = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/text`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      })

      if (statusResponse.ok) {
        result = await statusResponse.json()
        break
      }
    }

    if (!result) {
      throw new Error("LlamaParse processing timed out after 60 seconds.")
    }

    return result.text || ""
  } catch (error: any) {
    console.error("LlamaParse extraction error:", error)
    throw new Error(`Failed to extract text from ${filename}: ${error.message}`)
  }
}
