import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
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

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(error.message, { status: 400 })
    }
    console.error("Failed to save feedback:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
