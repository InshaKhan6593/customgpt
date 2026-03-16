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

  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    include: {
      developer: { select: { name: true } }
    }
  })

  if (!weblet) {
    notFound()
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <ChatSidebar webletId={weblet.id} />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
