import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
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
import { z } from 'zod'

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
    const messages = await convertToModelMessages(rawMessages as any)

    // 1. Verify Weblet Exists and Check Access (Payment Enforcement)
    const accessCheck = await checkAccess(webletId)

    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: accessCheck.reason }, { status: 402 }) // Payment Required
    }

    const weblet = await prisma.weblet.findUnique({
      where: { id: webletId },
      select: {
        capabilities: true, category: true, developerId: true,
        mcpServers: { where: { isActive: true } },
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

    // 2. Load System Prompt (Active Version)
    const activeVersion = await getActiveVersion(webletId)
    if (!activeVersion) {
      return NextResponse.json({ error: "No active instructions found for this Weblet" }, { status: 400 })
    }

    // Prepare system instructions — append formatting guidelines
    // so the LLM always uses proper markdown (code fences, headings, etc.)
    const FORMATTING_INSTRUCTIONS = `

## Response Formatting Rules
- Always format your responses using Markdown.
- When including code, ALWAYS wrap it in fenced code blocks with the language specified, like:
\`\`\`python
print("hello")
\`\`\`
- Use headings (##, ###), bold (**text**), bullet lists, and numbered lists when appropriate.
- Never output raw code without fenced code blocks.`

    const systemPrompt = activeVersion.prompt + FORMATTING_INSTRUCTIONS

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

    // 3.1 MCP Server Tools — connect to external MCP servers and merge their tools
    let mcpClients: Array<{ close: () => Promise<void> }> = []
    if (weblet.mcpServers && weblet.mcpServers.length > 0) {
      const mcpResult = await getMCPTools(weblet.mcpServers)
      tools = { ...tools, ...mcpResult.tools }
      mcpClients = mcpResult.clients
    }

    // 3.2 Composition Tools — expose child weblets as callable tools
    if (weblet.parentCompositions && weblet.parentCompositions.length > 0) {
      const childTools = createChildWebletTools(weblet.parentCompositions)
      tools = { ...tools, ...childTools }
    }

    // Ensure session exists
    let activeSessionId = sessionId

    // Get real authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id

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
          .filter(p => p.type === 'text')
          .map(p => (p as any).text)
          .join('\n')
      }
      await saveMessage(activeSessionId, "user", contentString)
    }

    // 4. Execute LLM Stream via OpenRouter Fallback Logic
    const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct";
    const model = getLanguageModel(modelId);

    const response = streamText({
      model,
      system: systemPrompt,
      messages: messages as any[],
      tools,
      stopWhen: stepCountIs(5),
      experimental_telemetry: {
        isEnabled: true,
        metadata: {
          webletId,
          sessionId: activeSessionId,
          userId,
        },
      },
      async onFinish({ text, steps, usage, finishReason }) {
        // Save assistant response
        await saveMessage(activeSessionId as string, "assistant", text, usage?.totalTokens)

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
