import { requireUser } from "@/lib/utils/auth-guard"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { ChatContainer } from "@/components/chat/chat-container"

export default async function NewChatPage({
  params,
}: {
  params: Promise<{ webletId: string }>
}) {
  const user = await requireUser()
  const { webletId } = await params

  // Fetch the weblet to get its name, icon, and conversation starters
  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    select: {
      id: true,
      name: true,
      iconUrl: true,
      developerId: true,
      versions: {
        where: { status: "ACTIVE" },
        take: 1,
        select: { prompt: true }
      }
    }
  })

  if (!weblet) {
    notFound()
  }

  // Parse prompt to get conversation starters
  let conversationStarters: string[] = []
  try {
    if (weblet.versions[0]?.prompt) {
      const parsed = JSON.parse(weblet.versions[0].prompt)
      conversationStarters = parsed.conversationStarters || []
    }
  } catch (e) {
    // If it's not JSON, it might just be the raw text instructions, so no starters
  }

  return (
    <ChatContainer 
      weblet={{
        id: weblet.id,
        name: weblet.name,
        iconUrl: weblet.iconUrl,
      }}
      conversationStarters={conversationStarters}
      session={null}
    />
  )
}
