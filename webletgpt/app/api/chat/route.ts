import { streamText, convertToModelMessages, stepCountIs } from 'ai'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLanguageModel } from '@/lib/ai/openrouter'
import { checkAccess } from '@/lib/chat/access'
import { getActiveVersion } from '@/lib/chat/engine'
import { logChatEvent } from '@/lib/chat/analytics'
import { getOrCreateChatSession, saveMessage } from '@/lib/chat/history'
import { auth } from '@/lib/auth'
import { getToolsFromCapabilities } from '@/lib/tools/registry'
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
      select: { capabilities: true, category: true } // We fetch version separately via engine.ts
    })

    if (!weblet) {
      return NextResponse.json({ error: "Weblet not found" }, { status: 404 })
    }

    // 2. Load System Prompt (Active Version)
    const activeVersion = await getActiveVersion(webletId)
    if (!activeVersion) {
      return NextResponse.json({ error: "No active instructions found for this Weblet" }, { status: 400 })
    }

    // Prepare system instructions for AI SDK
    const systemPrompt = activeVersion.prompt

    // 3. Assemble Tools based on Weblet capabilities config
    const tools = getToolsFromCapabilities(weblet.capabilities)

    // Ensure session exists
    let activeSessionId = sessionId
    
    // Get real authenticated user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const userId = session.user.id
    
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
      async onFinish({ text, toolCalls, toolResults, usage, finishReason }) {
        // Save assistant response
        await saveMessage(activeSessionId as string, "assistant", text, usage?.totalTokens)
        
        // Log telemetry event
        await logChatEvent(webletId, "chat_completed", {
          sessionId: activeSessionId,
          modelId,
          tokens: usage?.totalTokens,
          toolsUsed: toolCalls?.map(t => t.toolName) || [],
          finishReason
        })
      },
    })

    return response.toUIMessageStreamResponse();

  } catch (error: any) {
    console.error("Chat API error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
