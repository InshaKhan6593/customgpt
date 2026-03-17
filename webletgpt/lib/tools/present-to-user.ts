import { z } from "zod"

export const presentToUserTool = {
  description: `Present an artifact (image, file, chart, or code snippet) to the user so it renders visually in the chat UI.

WHEN TO USE:
- After generating an image with imageGeneration — call this to show it to the user.
- After creating files via codeInterpreter — call this to show download cards.
- After receiving artifacts from a sub-agent — call this to relay them to the user.
- When you find a relevant image/resource during research — call this to display it.

HOW IT WORKS:
- Each call to this tool renders ONE artifact in the chat UI.
- Call it multiple times to present multiple artifacts.
- If you do NOT call this tool, the user will NOT see the artifact.
- The artifact is displayed at the point in the conversation where you called the tool.

IMPORTANT:
- After calling this tool, do NOT also embed the URL in markdown. The tool handles rendering.
- You can add a caption to explain what the artifact is.`,
  toModelOutput: ({ output: result }: { toolCallId: string; input: unknown; output: any }) => {
    if (result?.error) return { type: 'text' as const, value: result.error }
    return { type: 'text' as const, value: `Artifact presented to user: ${result?.title || result?.type || 'item'}` }
  },
  inputSchema: z.object({
    type: z.enum(["image", "file", "code", "chart"]).describe("Type of artifact being presented"),
    url: z.string().describe("URL of the artifact (image URL, file download URL, etc.)"),
    title: z.string().optional().describe("Display title for the artifact"),
    caption: z.string().optional().describe("Brief explanation of what this artifact is"),
    mimeType: z.string().optional().describe("MIME type for files (e.g., 'text/python', 'application/pdf')"),
    fileName: z.string().optional().describe("Original filename for file downloads"),
  }),
  execute: async (input: { type: string; url: string; title?: string; caption?: string; mimeType?: string; fileName?: string }) => {
    return {
      presented: true,
      type: input.type,
      url: input.url,
      title: input.title || null,
      caption: input.caption || null,
      mimeType: input.mimeType || null,
      fileName: input.fileName || null,
    }
  },
}
