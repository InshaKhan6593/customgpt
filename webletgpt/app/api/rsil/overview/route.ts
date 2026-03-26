import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const weblets = await prisma.weblet.findMany({
      where: { developerId, rsilEnabled: true },
      include: {
        _count: {
          select: { versions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const items = await Promise.all(weblets.map(async (weblet) => {
      const interactionCount = await prisma.chatMessage.count({
        where: { chatSession: { webletId: weblet.id } },
      })

      return {
        id: weblet.id,
        name: weblet.name,
        slug: weblet.slug,
        iconUrl: weblet.iconUrl,
        rsilEnabled: weblet.rsilEnabled,
        totalVersions: weblet._count.versions,
        interactionCount,
      }
    }))

    return NextResponse.json({ weblets: items })
  } catch (error) {
    console.error("RSIL overview error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
