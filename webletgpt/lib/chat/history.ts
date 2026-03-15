import { prisma } from "@/lib/prisma"

/**
 * Ensures a chat session exists and assigns the user ID.
 */
export async function getOrCreateChatSession(
  webletId: string,
  userId: string,
  sessionId?: string | null
) {
  if (sessionId) {
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId, userId, webletId }
    })
    if (session) return session
  }

  // Create a new session if one wasn't provided or couldn't be found
  const newSession = await prisma.chatSession.create({
    data: {
      userId,
      webletId,
      title: "New Conversation" // Could be updated later based on LLM inference
    }
  })

  // Auto-add weblet to user's sidebar
  await prisma.userWeblet.upsert({
    where: { userId_webletId: { userId, webletId } },
    create: { userId, webletId },
    update: {},
  })

  return newSession
}

/**
 * Saves a new message to the database
 */
export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  tokensUsed?: number
) {
  return prisma.chatMessage.create({
    data: {
      chatSessionId: sessionId,
      role,
      content,
      tokensUsed
    }
  })
}

/**
 * Loads historical messages for a session
 */
export async function loadSessionMessages(sessionId: string) {
  const messages = await prisma.chatMessage.findMany({
    where: { chatSessionId: sessionId },
    orderBy: { createdAt: "asc" }
  })
  
  return messages.map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant' | 'system' | 'data',
    content: msg.content
  }))
}
