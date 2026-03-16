import { streamText, convertToModelMessages, stepCountIs, generateId } from 'ai'
import { stopWhenAny, toolLoopDetected, noProgressDetected } from '@/lib/ai/stop-conditions'
import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { truncateMessages } from '@/lib/utils/truncate'
import { langfuseSpanProcessor } from '@/instrumentation'
import { getLanguageModel } from '@/lib/ai/openrouter'
import { checkAccess } from '@/lib/chat/access'
import { getActiveVersion } from '@/lib/chat/engine'
import { logChatEvent } from '@/lib/chat/analytics'
import { getOrCreateChatSession, saveMessage } from '@/lib/chat/history'
import { auth } from '@/lib/auth'
import { getAlwaysAvailableTools, getToolsFromCapabilities } from '@/lib/tools/registry'
import { checkQuotas } from '@/lib/billing/quota-check'
import { logUsage } from '@/lib/billing/usage-logger'
import { getToolsFromOpenAPI } from '@/lib/tools/openapi'
import { getMCPTools, closeMCPClients } from '@/lib/mcp/client'
import { createChildWebletTools } from '@/lib/composition/child-tool-factory'
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
- When you are uncertain about something, say so clearly rather than guessing.
- When codeInterpreter creates files or charts, they are **automatically rendered in the UI** as download cards and inline images. Do NOT list, re-link, or enumerate created files/charts in your text. Describe what you built and how to use it instead.`

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

    // Pre-strip _childExecution from UIMessages BEFORE convertToModelMessages.
    // This is the primary fix: we operate on the client-side UIMessage format
    // where the result structure is predictable (tool-invocation parts with result).
    // convertToModelMessages serializes tool results to JSON strings, making the
    // post-conversion stripChildExecutionFromHistory unreliable.
    const cleanedRawMessages = preStripChildExecution(rawMessages as any[])

    // Use official Vercel utility for performant, native message conversion
    const messages = deduplicateToolUseIds(await convertToModelMessages(cleanedRawMessages as any, {
      // Skip tool calls that have no result (e.g., user refreshed mid-tool-call).
      // Without this, providers reject the incomplete tool_use/tool_result pair.
      ignoreIncompleteToolCalls: true,
    }))

    // Belt-and-suspenders: also strip any _childExecution that survived conversion
    // (handles edge cases where the AI SDK stores results in an object, not a string).
    stripChildExecutionFromHistory(messages)

    // ── Round 1: parallel — auth + weblet data (single DB round) ────────────
    const [authSession, weblet] = await Promise.all([
      auth(),
      prisma.weblet.findUnique({
        where: { id: webletId },
        select: {
          capabilities: true, category: true, developerId: true,
          accessType: true, monthlyPrice: true,
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
                select: { id: true, name: true, slug: true, description: true, capabilities: true },
              },
            },
          },
        }
      }),
    ])

    if (!authSession?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    const userId = authSession.user.id

    // Access check uses pre-fetched data — no extra DB queries
    const accessCheck = await checkAccess(webletId, {
      userId,
      developerId: weblet.developerId,
      accessType: weblet.accessType,
      monthlyPrice: weblet.monthlyPrice,
    })
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: accessCheck.reason }, { status: 402 })
    }

    // ── Round 2: parallel — version, quotas, session (pass pre-fetched data) ─
    const [activeVersion, quotaCheck, chatSession] = await Promise.all([
      getActiveVersion(webletId, userId),
      checkQuotas(userId, webletId, weblet.developerId),
      getOrCreateChatSession(webletId, userId, sessionId || null),
    ])

    if (!activeVersion) {
      return NextResponse.json({ error: "No active instructions found for this Weblet" }, { status: 400 })
    }
    if (!quotaCheck.allowed) {
      return NextResponse.json({ error: quotaCheck.reason || "Quota exceeded" }, { status: 402 })
    }

    const activeSessionId = chatSession.id

    // Extract user message text — used for saving + Langfuse trace input
    const latestUserMessage = messages[messages.length - 1]
    let userMessageText = ""
    if (latestUserMessage?.role === 'user') {
      if (typeof latestUserMessage.content === "string") {
        userMessageText = latestUserMessage.content
      } else if (Array.isArray(latestUserMessage.content)) {
        userMessageText = latestUserMessage.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n')
      }
      // User message is saved in after() alongside the assistant message —
      // this prevents orphaned user messages when the model/stream fails.
    }

    // ── Round 3: parallel — tools assembly (MCP needs network; others are sync) ─
    let systemPrompt = activeVersion.prompt + FORMATTING_INSTRUCTIONS
    let tools: Record<string, any> = { ...getAlwaysAvailableTools(), ...getToolsFromCapabilities(weblet.capabilities, webletId) }

    if (activeVersion.openapiSchema) {
      const customTools = getToolsFromOpenAPI(
        typeof activeVersion.openapiSchema === "string"
          ? activeVersion.openapiSchema
          : JSON.stringify(activeVersion.openapiSchema)
      )
      tools = { ...tools, ...customTools }
    }

    // MCP tools (async network) — compaction is done synchronously below
    const mcpResult = weblet.mcpServers?.length
      ? await getMCPTools(weblet.mcpServers.map((s: any) => ({ ...s, webletId })), userId)
      : { tools: {}, clients: [] as Array<{ close: () => Promise<void> }> }

    // Fast-path: skip the expensive LLM-powered compaction for short conversations.
    // For long ones, use simple truncation (keeps recent messages) instead of a full
    // generateText call that blocks streaming for 5-15 seconds.
    const compactedMessages = truncateMessages(messages, 33_000)

    tools = { ...tools, ...mcpResult.tools }
    const mcpClients = mcpResult.clients

    // Build capability prompt AFTER MCP tools are loaded so it can include them
    systemPrompt += buildCapabilityPrompt(weblet.capabilities, weblet.mcpServers, Object.keys(mcpResult.tools))

    if (weblet.parentCompositions?.length) {
      const childTools = createChildWebletTools(weblet.parentCompositions, 0, userId)
      tools = { ...tools, ...childTools }

      systemPrompt += `\n\n## Sub-Agent Orchestration

You have specialist sub-agents available as tools (look for weblet_* tools). For each request:
1. Identify which specialist has the right capability — their tool descriptions list what they can do.
2. Delegate entirely — do not do the work yourself if a specialist covers it.
3. Synthesize the specialist's response into your reply. Artifacts are already in the UI — acknowledge but do not re-link.`
    }

    const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct"
    const model = getLanguageModel(modelId)

    const toolNames = Object.keys(tools)
    console.log(`[Chat] model=${modelId} tools=${toolNames.length} (${toolNames.join(', ')}) msgs=${compactedMessages.length}`)

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
      maxRetries: 2,   // 3 total attempts (AI SDK default) — allows recovery from transient OpenRouter 500s
      stopWhen: stopWhenAny(stepCountIs(15), toolLoopDetected(3), noProgressDetected(6)),
      experimental_telemetry: {
        isEnabled: true,
        functionId: `weblet-${webletId}`,
        metadata: {
          "langfuse.trace.id": activeSessionId,
          "langfuse.trace.name": `weblet-${webletId}`,
          "langfuse.user.id": userId,
          "langfuse.session.id": activeSessionId,
          "langfuse.trace.tags": [`webletId:${webletId}`, `versionId:${activeVersion.id}`],
          ...(userMessageText ? { "langfuse.trace.input": userMessageText } : {}),
          "langfuse.trace.metadata.webletId": webletId,
          "langfuse.trace.metadata.modelId": modelId,
          "langfuse.trace.metadata.versionId": activeVersion.id,
          "langfuse.trace.metadata.versionNum": String(activeVersion.versionNum),
          "langfuse.trace.metadata.developerId": weblet.developerId,
          "langfuse.trace.metadata.mode": "DIRECT_CHAT",
        },
      },
      onFinish(data) {
        capturedFinish = data
      },
    })

    // ── Post-response cleanup via after() ─────────────────────────────────────
    // Runs AFTER the full response has been streamed to the client.
    // This means DB writes never block the user from seeing the AI response.
    after(async () => {
      // Always flush Langfuse traces + close MCP clients regardless of success/failure
      await langfuseSpanProcessor.forceFlush().catch(() => {})
      if (mcpClients.length) {
        await closeMCPClients(mcpClients).catch(err => console.error("Failed to close MCP clients:", err))
      }

      if (!capturedFinish) return

      // totalUsage aggregates across ALL steps (important for multi-step tool calls).
      // `usage` only covers the final step, which undercounts tokens.
      const { text: rawText, steps, totalUsage: usage, finishReason } = capturedFinish

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
      // Note: Langfuse trace is created by OTel (experimental_telemetry) with activeSessionId
      // as the trace ID (via langfuse.trace.id). No manual upsertTrace needed.
      // Both user + assistant messages saved here so orphans don't occur on stream failure.
      await Promise.all([
        userMessageText
          ? saveMessage(activeSessionId, "user", userMessageText)
              .catch(err => console.error("Failed to save user message:", err))
          : Promise.resolve(),
        saveMessage(activeSessionId, "assistant", finalText, usage?.totalTokens)
          .catch(err => console.error("Failed to save assistant message:", err)),

        // Persist the Langfuse trace ID so rate/route.ts can push user rating scores
        prisma.chatSession.update({
          where: { id: activeSessionId },
          data: { langfuseTraceId: activeSessionId },
        }).catch(err => console.error("Failed to set langfuseTraceId:", err)),

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

      ])
    })

    return response.toUIMessageStreamResponse({
      headers: {
        "x-chat-session-id": activeSessionId,
      },
      onError(error: any) {
        // Log the full error including OpenRouter's responseBody so we can
        // diagnose provider-specific failures (e.g. gpt-4o-mini schema rejects).
        const body = error?.responseBody || error?.cause?.responseBody || ""
        console.error("Stream error:", error?.message || error, body ? `\nOpenRouter body: ${body}` : "")

        // Surface model-specific errors so the client can show a helpful message
        const statusCode = error?.statusCode || error?.lastError?.statusCode || 0
        const msg = error?.message || ""
        if (statusCode === 500 || msg.includes("Internal Server Error") || msg.includes("RetryError")) {
          return `model_unavailable:${modelId}`
        }
        if (statusCode === 429 || msg.includes("rate limit")) {
          return `model_rate_limited:${modelId}`
        }
        return "Something went wrong generating a response. Please try again."
      },
    })

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

/**
 * Pre-strip _childExecution from UIMessages (client format) BEFORE convertToModelMessages.
 *
 * This is the primary defense. The rawMessages from the client are in UIMessage format:
 *   { role: "assistant", parts: [{ type: "tool-invocation", state: "result", result: {...} }] }
 * At this stage the result is a plain JS object — easy to inspect and clean.
 * After convertToModelMessages the result is serialized to a JSON string, making
 * detection unreliable (see stripChildExecutionFromHistory for the belt-and-suspenders pass).
 */
function preStripChildExecution(rawMessages: any[]): any[] {
  return rawMessages.map((msg) => {
    if (msg.role !== "assistant") return msg
    const parts = msg.parts
    if (!Array.isArray(parts)) return msg

    let changed = false
    const newParts = parts.map((part: any) => {
      if (part.type !== "tool-invocation") return part
      // AI SDK v5 uses "result", v6 uses "output-available"
      if (part.state !== "result" && part.state !== "output-available") return part
      // AI SDK v5 uses .result, v6 uses .output
      const toolOutput = part.output ?? part.result
      if (!toolOutput || typeof toolOutput !== "object" || !toolOutput._childExecution) return part

      changed = true
      const { _childExecution, ...rest } = toolOutput
      let responseText = rest.response || ""

      // Re-build artifact summary (mirrors toModelOutput)
      const artifacts: string[] = []
      for (const tc of _childExecution?.toolCalls || []) {
        const r = tc?.result
        if (!r || typeof r !== "object") continue
        if (r.url) artifacts.push(`Generated image (already shown in UI)`)
        for (const img of r.data?.images || []) {
          if (img.url) artifacts.push(`Generated chart (already shown in UI)`)
        }
        for (const f of r.data?.files || []) {
          if (f.url && f.name) artifacts.push(`Generated file: "${f.name}" (already shown as download card in UI)`)
        }
      }
      if (artifacts.length > 0) {
        responseText += "\n\n[Artifacts from sub-agent — already rendered in the UI]\n" + artifacts.join("\n")
      }

      // Write back to whichever property the SDK version uses
      const cleanResult = { response: responseText, source: rest.source }
      return { ...part, output: cleanResult, result: cleanResult }
    })

    return changed ? { ...msg, parts: newParts } : msg
  })
}

/**
 * Belt-and-suspenders pass: strip _childExecution from CoreMessages after conversion.
 *
 * convertToModelMessages serializes tool results in two ways depending on the AI SDK version:
 * - As an object in c.text (object case)
 * - As a JSON string in c.text (string case — the more common path)
 * Both are handled here to catch any that slipped through preStripChildExecution.
 *
 * Mutates in place — messages are already a fresh array from convertToModelMessages.
 */
function stripChildExecutionFromHistory(messages: any[]): void {
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue
    for (const part of msg.content) {
      if (part.type !== "tool-result") continue
      const content = part.content
      if (!Array.isArray(content)) continue
      for (let i = 0; i < content.length; i++) {
        const c = content[i]
        if (c.type !== "text") continue

        // Case 1: result stored as a JS object — serialize to string.
        // OpenAI/gpt-4o-mini requires tool result content to be a string, not an object.
        // This covers both _childExecution blobs and any other object result that
        // survived convertToModelMessages without being stringified.
        if (typeof c.text === "object" && c.text !== null) {
          const obj = c.text as any
          content[i] = { type: "text", text: obj._childExecution ? buildChildSummary(obj) : JSON.stringify(obj) }
          continue
        }

        // Case 2: result serialized as a JSON string containing _childExecution
        if (typeof c.text === "string" && c.text.includes("_childExecution")) {
          try {
            const parsed = JSON.parse(c.text)
            if (parsed?._childExecution) {
              content[i] = { type: "text", text: buildChildSummary(parsed) }
            }
          } catch {
            // Not valid JSON, leave as-is
          }
        }
      }
    }
  }
}

/**
 * Build a system prompt section that tells the LLM what capabilities it has.
 * Without this, the LLM has tool schemas but no guidance connecting user intents
 * (e.g. "create an artifact", "make a chart") to the right tool.
 */
function buildCapabilityPrompt(
  capabilities: any,
  mcpServers?: Array<{ label: string; description?: string | null }>,
  mcpToolNames?: string[]
): string {
  const caps: string[] = []
  if (capabilities?.codeInterpreter) {
    caps.push(
      '- **Code Interpreter (codeInterpreter)**: Execute Python code and produce real outputs. ' +
      'ALWAYS use this tool when the user asks to create files, build apps, analyze data, make charts, or compute anything. ' +
      'DO NOT paste code in your reply — run it with this tool. Files written to /home/user/ appear as download cards. ' +
      'Charts via matplotlib plt.show() render inline. If code fails, fix and retry.'
    )
  }
  if (capabilities?.webSearch) {
    caps.push(
      '- **Web Search (webSearch)**: You can search the web for live, up-to-date information. ' +
      'Use for current events, fact-checking, finding URLs, or any query that needs fresh data.'
    )
  }
  if (capabilities?.imageGen) {
    caps.push(
      '- **Image Generation (imageGeneration)**: You can generate images from text descriptions. ' +
      'Use when the user asks to create, draw, design, or visualize something as an image.'
    )
  }
  if (capabilities?.fileSearch) {
    caps.push(
      '- **File Search (fileSearch)**: You can search through uploaded knowledge base documents. ' +
      'Use when answering questions that may be covered by the knowledge base.'
    )
  }
  // MCP server tools
  if (mcpServers?.length && mcpToolNames?.length) {
    for (const server of mcpServers) {
      const prefix = `mcp_${server.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_')}_`
      const serverTools = mcpToolNames.filter(t => t.startsWith(prefix))
      if (serverTools.length > 0) {
        const toolList = serverTools.map(t => `\`${t}\``).join(', ')
        caps.push(
          `- **${server.label}** (MCP): ${server.description || 'External service integration'}. ` +
          `Tools: ${toolList}. Use these when the task involves ${server.label} functionality.`
        )
      }
    }
  }
  if (caps.length === 0) return ''
  return '\n\n## Your Tools\nYou have the following capabilities — use them proactively when the task calls for it:\n' + caps.join('\n')
}

/** Shared helper: build clean text from a raw child weblet result object. */
function buildChildSummary(raw: any): string {
  let text = raw.response || ""
  const artifacts: string[] = []
  for (const tc of raw._childExecution?.toolCalls || []) {
    const r = tc?.result
    if (!r || typeof r !== "object") continue
    if (r.url) artifacts.push(`Generated image (already shown in UI)`)
    for (const img of r.data?.images || []) {
      if (img.url) artifacts.push(`Generated chart (already shown in UI)`)
    }
    for (const f of r.data?.files || []) {
      if (f.url && f.name) artifacts.push(`Generated file: "${f.name}" (shown as download card in UI)`)
    }
  }
  if (artifacts.length > 0) {
    text += "\n\n[Artifacts from sub-agent — already rendered in the UI]\n" + artifacts.join("\n")
  }
  return text
}
