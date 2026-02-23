import { prisma } from "@/lib/prisma"

export async function logChatEvent(
  webletId: string,
  eventType: "chat_started" | "chat_completed" | "tool_call" | "rating_given" | "error",
  eventData?: any
) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        webletId,
        eventType,
        eventData: eventData ? eventData : null
      }
    })
  } catch (error) {
    console.error("Failed to log chat analytics event:", error)
  }
}
