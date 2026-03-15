/**
 * Sync a WebletVersion prompt to Langfuse Prompt Management.
 * This allows RSIL to compare prompt versions in Langfuse UI.
 */

const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com"

function basicAuth() {
  const pub = process.env.LANGFUSE_PUBLIC_KEY!
  const sec = process.env.LANGFUSE_SECRET_KEY!
  return "Basic " + Buffer.from(`${pub}:${sec}`).toString("base64")
}

export async function syncPromptToLangfuse({
  webletId,
  webletName,
  prompt,
  versionNum,
  isActive,
}: {
  webletId: string
  webletName: string
  prompt: string
  versionNum: number
  isActive: boolean
}) {
  try {
    const promptName = `weblet-${webletId}`

    // Create a new prompt version in Langfuse
    const res = await fetch(`${LANGFUSE_BASE}/api/public/v2/prompts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth(),
      },
      body: JSON.stringify({
        name: promptName,
        prompt,
        labels: isActive ? ["production"] : ["staging"],
        config: { webletId, webletName, versionNum },
        commitMessage: `v${versionNum}${isActive ? " (active)" : ""}`,
      }),
    })

    if (!res.ok) {
      console.error(`Langfuse prompt sync failed: ${res.status} ${await res.text()}`)
      return null
    }

    return res.json()
  } catch (err) {
    console.error("Langfuse prompt sync error:", err)
    return null
  }
}
