import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { pushScore } from "@/lib/langfuse/client"
import { z } from "zod"

const schema = z.object({
  sessionId: z.string(),
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

  const { sessionId, score, comment } = result.data

  // Verify session belongs to this user
  const chatSession = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
    select: { id: true, langfuseTraceId: true, webletId: true },
  })

  if (!chatSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  // Push to Langfuse if we have a trace ID
  if (chatSession.langfuseTraceId) {
    await pushScore({
      traceId: chatSession.langfuseTraceId,
      name: "user-rating",
      value: score,
      comment,
      id: `${chatSession.langfuseTraceId}-user-rating`,
      dataType: "NUMERIC",
    }).catch(err => console.error("Langfuse score push failed:", err))
  }

  // Also log to local analytics
  await prisma.analyticsEvent.create({
    data: {
      webletId: chatSession.webletId,
      eventType: "user_rating",
      eventData: { sessionId, score, comment, langfuseTraceId: chatSession.langfuseTraceId },
    },
  })

  return NextResponse.json({ ok: true })
}
