import { requireUser } from "@/lib/utils/auth-guard"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { ChatSidebar } from "@/components/chat/chat-sidebar"

interface ChatLayoutProps {
  children: React.ReactNode
  params: Promise<{ webletId: string }>
}

export default async function ChatLayout({
  children,
  params,
}: ChatLayoutProps) {
  const user = await requireUser()
  const { webletId } = await params

  if (!webletId) {
    notFound()
  }

  // Fetch weblet to ensure it exists and we have access
  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    include: {
      developer: { select: { name: true } }
    }
  })

  if (!weblet) {
    notFound()
  }

  // TODO: Segment 7 & 8 - RSIL Enforcement (ENABLE_PAYMENT_ENFORCEMENT flag)
  // For now, allow access or add a basic check if needed.

  // Fetch recent chat sessions for this user AND this weblet
  const chatSessions = await prisma.chatSession.findMany({
    where: {
      userId: user.id,
      webletId: weblet.id,
    },
    orderBy: {
      updatedAt: 'desc'
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
    }
  })

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar 
        webletId={weblet.id} 
        sessions={chatSessions} 
      />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
