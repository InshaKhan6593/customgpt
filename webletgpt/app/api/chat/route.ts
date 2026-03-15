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

    // 1. Verify Weblet Exists and Check Access (Payment Enforcement)
    const accessCheck = await checkAccess(webletId)

    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: accessCheck.reason }, { status: 402 }) // Payment Required
    }

    const weblet = await prisma.weblet.findUnique({
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
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    // Get real authenticated user (needed for MCP user tokens + quotas)
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

    // 2. Load System Prompt (Active Version)
    const activeVersion = await getActiveVersion(webletId, userId)
    if (!activeVersion) {
      return NextResponse.json({ error: "No active instructions found for this Weblet" }, { status: 400 })
    }

    let systemPrompt = activeVersion.prompt + FORMATTING_INSTRUCTIONS

    // 3. Assemble Tools based on Weblet capabilities config, custom Actions, and MCP servers
    let tools = getToolsFromCapabilities(weblet.capabilities, webletId)

    if (activeVersion.openapiSchema) {
      const customTools = getToolsFromOpenAPI(
        typeof activeVersion.openapiSchema === "string"
          ? activeVersion.openapiSchema
          : JSON.stringify(activeVersion.openapiSchema)
      )
      tools = { ...tools, ...customTools }
    }

    // 3.1 MCP Server Tools — pass userId so requiresUserAuth servers use the user's token
    let mcpClients: Array<{ close: () => Promise<void> }> = []
    if (weblet.mcpServers && weblet.mcpServers.length > 0) {
      const serversWithWebletId = weblet.mcpServers.map((s: any) => ({ ...s, webletId }))
      const mcpResult = await getMCPTools(serversWithWebletId, userId)
      tools = { ...tools, ...mcpResult.tools }
      mcpClients = mcpResult.clients
    }

    // 3.2 Composition Tools — expose child weblets as callable tools
    if (weblet.parentCompositions && weblet.parentCompositions.length > 0) {
      const childTools = createChildWebletTools(weblet.parentCompositions, 0, userId)
      tools = { ...tools, ...childTools }

      // Tell the parent about its child agents so it knows when to delegate
      const childDescriptions = weblet.parentCompositions.map((comp: any) => {
        const child = comp.childWeblet
        return `- **${child.name}** (tool: \`weblet_${child.slug.replace(/[^a-z0-9_]/g, "_")}\`): ${child.description || "A specialized AI assistant"}`
      }).join("\n")

      systemPrompt += `\n\n## Specialized Agents\nYou have access to the following specialized agent weblets. Delegate tasks to them when the task falls within their expertise — they have their own tools and capabilities.\n${childDescriptions}\n\nWhen delegating, send a clear, specific task description as the message. The agent will work autonomously and return its result to you. Then synthesize the result into your response to the user.`
    }

    // Ensure session exists
    let activeSessionId = sessionId

    // 3.5 Check Quotas before executing LLM
    const quotaCheck = await checkQuotas(userId, webletId)
    if (!quotaCheck.allowed) {
      return NextResponse.json({ error: quotaCheck.reason || "Quota exceeded" }, { status: 402 })
    }

    const chatSession = await getOrCreateChatSession(webletId, userId, activeSessionId || null)
    activeSessionId = chatSession.id

    // Save the incoming user message to history
    const latestUserMessage = messages[messages.length - 1]
    if (latestUserMessage && latestUserMessage.role === 'user') {
      let contentString = ""
      if (typeof latestUserMessage.content === "string") {
        contentString = latestUserMessage.content
      } else if (Array.isArray(latestUserMessage.content)) {
        contentString = latestUserMessage.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => (p as any).text)
          .join('\n')
      }
      await saveMessage(activeSessionId, "user", contentString)
    }

    // 4. Execute LLM Stream via OpenRouter Fallback Logic
    const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct";
    const model = getLanguageModel(modelId);

    // Truncate/Compact conversation to fit within model context window (~33K tokens budget).
    // Uses pre-flight compaction to preserve token buffer and execute summarizations.
    const compactedMessages = await autoCompactMessages(messages, 33_000, model)

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
      async onFinish({ text, steps, usage, finishReason }) {
        // If the model ended on a tool call with no final text, fall back to
        // the last tool result so we never save a blank assistant message.
        let finalText = text;
        if (!finalText.trim() && steps && steps.length > 0) {
          const lastStep = steps[steps.length - 1];
          const results = (lastStep as any).toolResults;
          if (results && results.length > 0) {
            const last = results[results.length - 1];
            if (typeof last.result === "string") {
              finalText = last.result;
            } else if (last.result && typeof last.result === 'object') {
              if (last.result.text) {
                finalText = last.result.text;
              } else if (last.result.stdout) {
                finalText = last.result.stdout;
              } else {
                finalText = JSON.stringify({ stdout: last.result.stdout, stderr: last.result.stderr, error: last.result.error });
              }
            } else {
              finalText = JSON.stringify(last.result, null, 2);
            }
          }
        }

        // Save assistant response
        await saveMessage(activeSessionId as string, "assistant", finalText, usage?.totalTokens)

        // Save Langfuse trace ID to ChatSession for score linking
        // We use activeSessionId as the Langfuse trace ID so scores can always be linked
        const traceId = activeSessionId as string
        upsertTrace({
          id: traceId,
          name: `weblet-${webletId}`,
          userId,
          sessionId: traceId,
          output: finalText,
          metadata: { webletId, modelId, versionId: activeVersion.id, versionNum: String(activeVersion.versionNum) },
          tags: [`webletId:${webletId}`, `versionId:${activeVersion.id}`],
        }).catch(err => console.error("Langfuse upsertTrace failed:", err))

        // Save langfuseTraceId to ChatSession
        prisma.chatSession.update({
          where: { id: traceId },
          data: { langfuseTraceId: traceId },
        }).catch(err => console.error("Failed to save langfuseTraceId:", err))

        // Count tool usages across ALL steps (multi-step execution can have up to 5 steps)
        const toolCounts: Record<string, number> = {};
        const allToolNames: string[] = [];
        if (steps) {
          for (const step of steps) {
            if (step.toolCalls) {
              for (const tc of step.toolCalls) {
                toolCounts[tc.toolName] = (toolCounts[tc.toolName] || 0) + 1;
                allToolNames.push(tc.toolName);
              }
            }
          }
        }

        // Log usage in the background
        if (usage?.totalTokens) {
          await logUsage({
            userId,
            webletId,
            developerId: weblet.developerId,
            sessionId: activeSessionId,
            tokensIn: (usage as any)?.promptTokens || 0,
            tokensOut: (usage as any)?.completionTokens || 0,
            modelId,
            toolCalls: Object.keys(toolCounts).length > 0 ? toolCounts : null,
            source: "DIRECT_CHAT",
          }).catch(err => console.error("Failed to log usage:", err));
        }

        // Log telemetry event
        await logChatEvent(webletId, "chat_completed", {
          sessionId: activeSessionId,
          modelId,
          tokens: usage?.totalTokens,
          toolsUsed: allToolNames,
          finishReason
        })

        // Close MCP clients to free resources
        if (mcpClients.length > 0) {
          await closeMCPClients(mcpClients)
        }
      },
    })

    // Critical for serverless: flush traces before function terminates
    after(async () => await langfuseSpanProcessor.forceFlush());

    return response.toUIMessageStreamResponse();

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
