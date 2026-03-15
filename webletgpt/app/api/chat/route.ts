import { streamText, convertToModelMessages, stepCountIs, generateId } from 'ai'
import { stopWhenAny, toolLoopDetected, noProgressDetected } from '@/lib/ai/stop-conditions'
import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { autoCompactMessages } from '@/lib/utils/truncate'
import { langfuseSpanProcessor } from '@/instrumentation'
import { getLanguageModel } from '@/lib/ai/openrouter'
import { checkAccess } from '@/lib/chat/access'
import { getActiveVersion } from '@/lib/chat/engine'
import { logChatEvent } from '@/lib/chat/analytics'
import { getOrCreateChatSession, saveMessage } from '@/lib/chat/history'
import { auth } from '@/lib/auth'
import { getToolsFromCapabilities } from '@/lib/tools/registry'
import { checkQuotas } from '@/lib/billing/quota-check'
import { logUsage } from '@/lib/billing/usage-logger'
import { getToolsFromOpenAPI } from '@/lib/tools/openapi'
import { getMCPTools, closeMCPClients } from '@/lib/mcp/client'
import { createChildWebletTools } from '@/lib/composition/child-tool-factory'
import { upsertTrace } from '@/lib/langfuse/client'
import { z } from 'zod'

// Module-level constant — avoids re-creating the string on every request
const FORMATTING_INSTRUCTIONS = `

## Response Guidelines
- Format all responses using Markdown for readability.
- When including code, ALWAYS use fenced code blocks with the language specified:
\`\`\`python
print("hello")
\`\`\`
- Use headings (##, ###), **bold**, bullet lists, and numbered lists to structure longer responses.
- Never output raw code without fenced code blocks.
- Be direct and helpful — answer the user's question first, then provide additional context if needed.
- If you use any tools to look up information, present the findings naturally without exposing raw tool output.
- When you are uncertain about something, say so clearly rather than guessing.`

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system", "tool", "data"]),
    content: z.any().optional(),
    parts: z.any().optional(),
    id: z.string().optional()
  })),
  webletId: z.string(),
  sessionId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const result = chatSchema.safeParse(json)

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error }, { status: 400 })
    }

    const { messages: rawMessages, webletId, sessionId } = result.data

    // Use official Vercel utility for performant, native message conversion
    const messages = deduplicateToolUseIds(await convertToModelMessages(rawMessages as any))

    // ── Round 1: parallel — access check, session auth, weblet data ──────────
    const [accessCheck, authSession, weblet] = await Promise.all([
      checkAccess(webletId),
      auth(),
      prisma.weblet.findUnique({
        where: { id: webletId },
        select: {
          capabilities: true, category: true, developerId: true,
          mcpServers: {
            where: { isActive: true },
            select: {
              id: true, serverUrl: true, label: true, authToken: true,
              requiresUserAuth: true, isActive: true, catalogId: true, tools: true,
            },
          },
          parentCompositions: {
            include: {
              childWeblet: {
                select: { id: true, name: true, slug: true, description: true },
              },
            },
          },
        }
      }),
    ])

    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: accessCheck.reason }, { status: 402 })
    }
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const userId = authSession.user.id

    // ── Round 2: parallel — version, quotas, session (all need userId) ────────
    const [activeVersion, quotaCheck, chatSession] = await Promise.all([
      getActiveVersion(webletId, userId),
      checkQuotas(userId, webletId),
      getOrCreateChatSession(webletId, userId, sessionId || null),
    ])

    if (!activeVersion) {
      return NextResponse.json({ error: "No active instructions found for this Weblet" }, { status: 400 })
    }
    if (!quotaCheck.allowed) {
      return NextResponse.json({ error: quotaCheck.reason || "Quota exceeded" }, { status: 402 })
    }

    const activeSessionId = chatSession.id

    // Save user message fire-and-forget — order is guaranteed by chatSession creation above
    const latestUserMessage = messages[messages.length - 1]
    if (latestUserMessage?.role === 'user') {
      let contentString = ""
      if (typeof latestUserMessage.content === "string") {
        contentString = latestUserMessage.content
      } else if (Array.isArray(latestUserMessage.content)) {
        contentString = latestUserMessage.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n')
      }
      // Fire-and-forget — don't block stream start for a write
      saveMessage(activeSessionId, "user", contentString).catch(err =>
        console.error("Failed to save user message:", err)
      )
    }

    // ── Round 3: parallel — tools assembly (MCP needs network; others are sync) ─
    let systemPrompt = activeVersion.prompt + FORMATTING_INSTRUCTIONS
    let tools = getToolsFromCapabilities(weblet.capabilities, webletId)

    if (activeVersion.openapiSchema) {
      const customTools = getToolsFromOpenAPI(
        typeof activeVersion.openapiSchema === "string"
          ? activeVersion.openapiSchema
          : JSON.stringify(activeVersion.openapiSchema)
      )
      tools = { ...tools, ...customTools }
    }

    // Composition tools (sync) + MCP tools (async network) in parallel
    const [mcpResult, compactedMessages] = await Promise.all([
      weblet.mcpServers?.length
        ? getMCPTools(weblet.mcpServers.map((s: any) => ({ ...s, webletId })), userId)
        : Promise.resolve({ tools: {}, clients: [] as Array<{ close: () => Promise<void> }> }),
      autoCompactMessages(messages, 33_000, getLanguageModel(activeVersion.model || "meta-llama/llama-3.3-70b-instruct")),
    ])

    tools = { ...tools, ...mcpResult.tools }
    const mcpClients = mcpResult.clients

    if (weblet.parentCompositions?.length) {
      const childTools = createChildWebletTools(weblet.parentCompositions, 0, userId)
      tools = { ...tools, ...childTools }

      const childDescriptions = weblet.parentCompositions.map((comp: any) => {
        const child = comp.childWeblet
        return `- **${child.name}** (tool: \`weblet_${child.slug.replace(/[^a-z0-9_]/g, "_")}\`): ${child.description || "A specialized AI assistant"}`
      }).join("\n")

      systemPrompt += `\n\n## Specialized Agents\nYou have access to the following specialized agent weblets. Delegate tasks to them when the task falls within their expertise — they have their own tools and capabilities.\n${childDescriptions}\n\nWhen delegating, send a clear, specific task description as the message. The agent will work autonomously and return its result to you. Then synthesize the result into your response to the user.`
    }

    const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct"
    const model = getLanguageModel(modelId)

    // ── Stream ────────────────────────────────────────────────────────────────
    // Capture onFinish data synchronously so after() can process it post-response.
    // NEVER await anything in onFinish — that would hold the stream open and cause
    // visible pauses after the last token.
    type FinishData = Parameters<NonNullable<Parameters<typeof streamText>[0]['onFinish']>>[0]
    let capturedFinish: FinishData | null = null

    const response = streamText({
      model,
      system: systemPrompt,
      messages: compactedMessages as any[],
      tools,
      stopWhen: stopWhenAny(stepCountIs(15), toolLoopDetected(3), noProgressDetected(6)),
      experimental_telemetry: {
        isEnabled: true,
        functionId: `weblet-${webletId}`,
        metadata: {
          webletId,
          sessionId: activeSessionId,
          userId,
          developerId: weblet.developerId,
          modelId,
          versionId: activeVersion.id,
          versionNum: String(activeVersion.versionNum),
          mode: "DIRECT_CHAT",
        },
      },
      onFinish(data) {
        // Synchronous capture only — no awaits here.
        // All DB writes, billing, and cleanup run in after() below.
        capturedFinish = data
      },
    })

    // ── Post-response cleanup via after() ─────────────────────────────────────
    // Runs AFTER the full response has been streamed to the client.
    // This means DB writes never block the user from seeing the AI response.
    after(async () => {
      // Always flush Langfuse traces
      await langfuseSpanProcessor.forceFlush().catch(() => {})

      if (!capturedFinish) return

      const { text: rawText, steps, usage, finishReason } = capturedFinish

      // Build finalText with same fallback logic as before
      let finalText = rawText ?? ""
      if (!finalText.trim() && steps?.length) {
        const lastStep = steps[steps.length - 1]
        const results = (lastStep as any).toolResults
        if (results?.length) {
          const last = results[results.length - 1]
          if (typeof last.result === "string") {
            finalText = last.result
          } else if (last.result && typeof last.result === 'object') {
            if (last.result.response) finalText = last.result.response
            else if (last.result.text) finalText = last.result.text
            else if (last.result.stdout) finalText = last.result.stdout
            else if (last.result.error) finalText = last.result.error
            else finalText = JSON.stringify(last.result, null, 2)
          } else {
            finalText = JSON.stringify(last.result, null, 2)
          }
        }
      }
      if (!finalText?.trim()) finalText = "(No response)"

      // All writes run in parallel — they're independent of each other
      const traceId = activeSessionId
      await Promise.all([
        saveMessage(activeSessionId, "assistant", finalText, usage?.totalTokens)
          .catch(err => console.error("Failed to save assistant message:", err)),

        upsertTrace({
          id: traceId,
          name: `weblet-${webletId}`,
          userId,
          sessionId: traceId,
          output: finalText,
          metadata: { webletId, modelId, versionId: activeVersion.id, versionNum: String(activeVersion.versionNum) },
          tags: [`webletId:${webletId}`, `versionId:${activeVersion.id}`],
        }).catch(err => console.error("Langfuse upsertTrace failed:", err)),

        prisma.chatSession.update({
          where: { id: traceId },
          data: { langfuseTraceId: traceId },
        }).catch(err => console.error("Failed to save langfuseTraceId:", err)),

        (async () => {
          if (!usage?.totalTokens) return
          const toolCounts: Record<string, number> = {}
          const allToolNames: string[] = []
          for (const step of steps ?? []) {
            for (const tc of step.toolCalls ?? []) {
              toolCounts[tc.toolName] = (toolCounts[tc.toolName] || 0) + 1
              allToolNames.push(tc.toolName)
            }
          }
          await Promise.all([
            logUsage({
              userId,
              webletId,
              developerId: weblet.developerId,
              sessionId: activeSessionId,
              tokensIn: (usage as any)?.promptTokens || 0,
              tokensOut: (usage as any)?.completionTokens || 0,
              modelId,
              toolCalls: Object.keys(toolCounts).length ? toolCounts : null,
              source: "DIRECT_CHAT",
            }).catch(err => console.error("Failed to log usage:", err)),

            logChatEvent(webletId, "chat_completed", {
              sessionId: activeSessionId,
              modelId,
              tokens: usage?.totalTokens,
              toolsUsed: allToolNames,
              finishReason,
            }).catch(err => console.error("Failed to log chat event:", err)),
          ])
        })(),

        mcpClients.length
          ? closeMCPClients(mcpClients).catch(err => console.error("Failed to close MCP clients:", err))
          : Promise.resolve(),
      ])
    })

    return response.toUIMessageStreamResponse()

  } catch (error: any) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


/**
 * Normalize tool IDs so every tool-call / tool-result pair has a unique ID.
 *
 * Providers like Anthropic (Bedrock) reject requests when two tool_use blocks
 * share the same ID — which happens when multi-step conversations are replayed.
 *
 * Strategy: give every tool-call a fresh ID, then patch each tool-result to
 * reference the new ID of its matching tool-call. Single pass, O(n).
 */
function deduplicateToolUseIds(messages: any[]): any[] {
  const idMap = new Map<string, string>() // oldId → newId

  return messages.map((msg) => {
    if (!Array.isArray(msg.content)) return msg

    const newContent = msg.content.map((part: any) => {
      if (part.type === "tool-call" && part.toolCallId) {
        const newId = generateId()
        idMap.set(part.toolCallId, newId)
        return { ...part, toolCallId: newId }
      }

      if (part.type === "tool-result" && part.toolCallId) {
        const newId = idMap.get(part.toolCallId)
        if (newId) return { ...part, toolCallId: newId }
      }

      return part
    })

    return { ...msg, content: newContent }
  })
}
