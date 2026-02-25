import { requireUser } from "@/lib/utils/auth-guard"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ChatContainer } from "@/components/chat/chat-container"
import { UIMessage } from "ai"
import { ENABLE_PAYMENT_ENFORCEMENT } from "@/lib/constants"
import { Paywall } from "@/components/monetization/paywall"

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
          developerId: true,
          accessType: true,
          monthlyPrice: true,
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

  // Payment Check
  let hasAccess = true
  if (ENABLE_PAYMENT_ENFORCEMENT && session.weblet.accessType === "SUBSCRIBERS_ONLY") {
    if (user.id !== session.weblet.developerId) {
      const activeSub = await prisma.subscription.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
      })
      if (!activeSub) {
        hasAccess = false
      }
    }
  }

  if (!hasAccess) {
    return (
      <div className="flex-1 overflow-auto bg-background p-4 sm:p-8">
        <Paywall
          webletId={session.weblet.id}
          webletName={session.weblet.name}
          monthlyPrice={session.weblet.monthlyPrice || 0}
        />
      </div>
    )
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
