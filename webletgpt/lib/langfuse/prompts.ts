import { langfuse } from "@/lib/langfuse/client"

export function getLangfusePromptName(webletId: string): string {
  return `weblet-${webletId}`
}

export async function syncPromptToLangfuse({
  webletId,
  webletName,
  versionId,
  versionNum,
  prompt,
  labels,
  commitMessage,
}: {
  webletId: string
  webletName: string
  versionId: string
  versionNum: number
  prompt: string
  labels?: string[]
  commitMessage?: string
}): Promise<{ promptName: string; promptVersion: number }> {
  const promptName = getLangfusePromptName(webletId)

  try {
    const createdPrompt = await langfuse.prompt.create({
      name: promptName,
      type: "text",
      prompt,
      labels,
      commitMessage: `v${versionNum}: ${commitMessage || "RSIL sync"}`,
      config: {
        webletName,
        versionId,
        versionNum,
      },
    })

    return {
      promptName: createdPrompt.name,
      promptVersion: createdPrompt.version,
    }
  } catch (error) {
    console.error("Failed to sync prompt to Langfuse", {
      webletId,
      versionId,
      versionNum,
      error,
    })

    return {
      promptName,
      promptVersion: versionNum,
    }
  }
}

export async function getPromptFromLangfuse({
  webletId,
  label,
  version,
}: {
  webletId: string
  label?: string
  version?: number
}): Promise<{ prompt: string; version: number; labels: string[] } | null> {
  try {
    const promptClient = await langfuse.prompt.get(getLangfusePromptName(webletId), {
      label,
      version,
      type: "text",
      cacheTtlSeconds: 300,
    })

    return {
      prompt: promptClient.prompt,
      version: promptClient.version,
      labels: promptClient.labels,
    }
  } catch (error) {
    console.error("Failed to fetch prompt from Langfuse", {
      webletId,
      label,
      version,
      error,
    })

    return null
  }
}

export async function updatePromptLabels({
  webletId,
  version,
  newLabels,
}: {
  webletId: string
  version: number
  newLabels: string[]
}): Promise<void> {
  try {
    await langfuse.prompt.update({
      name: getLangfusePromptName(webletId),
      version,
      newLabels,
    })
  } catch (error) {
    console.error("Failed to update Langfuse prompt labels", {
      webletId,
      version,
      newLabels,
      error,
    })
  }
}
