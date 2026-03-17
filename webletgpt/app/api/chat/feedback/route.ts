import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { pushScore } from "@/lib/langfuse/client"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const feedbackSchema = z.object({
  webletId: z.string(),
  sessionId: z.string().optional(),
  messageId: z.string().optional(),
  rating: z.enum(["UP", "DOWN"]),
  feedbackText: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const json = await req.json()
    const { webletId, sessionId, messageId, rating, feedbackText } = feedbackSchema.parse(json)

    // Save as AnalyticsEvent for RSIL
    await prisma.analyticsEvent.create({
      data: {
        webletId,
        eventType: rating === "UP" ? "thumbs_up" : "thumbs_down",
        eventData: {
          sessionId,
          messageId,
          feedbackText,
          timestamp: new Date().toISOString()
        }
      }
    })

    if (sessionId) {
      try {
        let langfuseTraceId: string | null | undefined

        if (messageId) {
          const chatMessage = await prisma.chatMessage.findFirst({
            where: {
              id: messageId,
              chatSessionId: sessionId,
            },
            select: { langfuseTraceId: true },
          })

          langfuseTraceId = chatMessage?.langfuseTraceId
        }

        if (!langfuseTraceId) {
          const chatSession = await prisma.chatSession.findUnique({
            where: { id: sessionId },
            select: { langfuseTraceId: true },
          })
          langfuseTraceId = chatSession?.langfuseTraceId
        }

        if (langfuseTraceId) {
          await pushScore({
            traceId: langfuseTraceId,
            name: 'user-rating',
            value: rating === 'UP' ? 5 : 1,
            comment: feedbackText || undefined,
            dataType: 'NUMERIC',
          })
        }
      } catch (langfuseError) {
        console.error('Failed to push score to Langfuse:', langfuseError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(error.message, { status: 400 })
    }
    console.error("Failed to save feedback:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
