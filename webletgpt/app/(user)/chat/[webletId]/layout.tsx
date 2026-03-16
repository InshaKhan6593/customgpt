import { requireUser } from "@/lib/utils/auth-guard"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { ChatLayoutShell } from "@/components/chat/chat-layout-shell"

interface ChatLayoutProps {
  children: React.ReactNode
  params: Promise<{ webletId: string }>
}

export default async function ChatLayout({
  children,
  params,
}: ChatLayoutProps) {
  await requireUser()
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

  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <ChatLayoutShell webletId={weblet.id} defaultSidebarOpen={sidebarOpen}>
      {children}
    </ChatLayoutShell>
  )
}
