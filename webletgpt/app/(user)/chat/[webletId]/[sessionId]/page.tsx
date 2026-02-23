import { requireUser } from "@/lib/utils/auth-guard"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ChatContainer } from "@/components/chat/chat-container"
import { UIMessage } from "ai"

export default async function ExistingChatPage({
  params,
}: {
  params: Promise<{ webletId: string; sessionId: string }>
}) {
  const user = await requireUser()
  const { webletId, sessionId } = await params

  // Verify the session belongs to this user and weblet
  const session = await prisma.chatSession.findUnique({
    where: { 
      id: sessionId,
      userId: user.id,
      webletId: webletId
    },
    include: {
      weblet: {
        select: {
          id: true,
          name: true,
          iconUrl: true,
        }
      },
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!session) {
    notFound()
  }

  // Convert Prisma messages to AI SDK format
  const initialMessages: UIMessage[] = session.messages.map(m => ({
    id: m.id,
    role: m.role as "system" | "user" | "assistant",
    parts: [{ type: 'text', text: m.content as string }]
  }))

  return (
    <ChatContainer 
      weblet={{
        id: session.weblet.id,
        name: session.weblet.name,
        iconUrl: session.weblet.iconUrl,
      }}
      session={{
        id: session.id,
      }}
      initialMessages={initialMessages}
    />
  )
}
