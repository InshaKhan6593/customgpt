import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { createLangfuseScore } from "@/lib/langfuse/client"

const schema = z.object({
  sessionId: z.string(),
  messageId: z.string().optional(),
  score: z.number().min(1).max(5),
  comment: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const { sessionId, messageId, score, comment } = result.data

  // Verify session belongs to this user
  const chatSession = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
    select: { id: true, webletId: true },
  })

  if (!chatSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Log to local analytics (DB record of user rating)
  await prisma.analyticsEvent.create({
    data: {
      webletId: chatSession.webletId,
      eventType: "user_rating",
      eventData: { sessionId, messageId, score, comment },
    },
  })

  // Bridge to Langfuse score (fire-and-forget — never block response)
  if (messageId) {
    void (async () => {
      try {
        const message = await prisma.chatMessage.findUnique({
          where: { id: messageId },
          select: { langfuseTraceId: true },
        })
        if (message?.langfuseTraceId) {
          await createLangfuseScore({
            traceId: message.langfuseTraceId,
            name: 'user-rating',
            value: score,
            dataType: 'NUMERIC',
            comment: comment ?? undefined,
            id: `user-rating-${messageId}`,
          })
        } else {
          console.warn('[rsil] No traceId for rating — skipping Langfuse score', { messageId })
        }
      } catch (err) {
        console.warn('[rsil] Failed to bridge rating to Langfuse:', err)
      }
    })()
  }

  return NextResponse.json({ ok: true })
}
