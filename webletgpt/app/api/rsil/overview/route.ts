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
        versions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: {
          select: { versions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    const items = await Promise.all(weblets.map(async (weblet) => {
      const latestVersion = weblet.versions[0] ?? null
      const activeVersion = await prisma.webletVersion.findFirst({
        where: { webletId: weblet.id, status: "ACTIVE" },
        select: { id: true, prompt: true },
        orderBy: { createdAt: "desc" },
      })
      const activeTest = weblet.versions.find(version => version.status === "TESTING" && version.isAbTest)

      const interactionCount = await prisma.chatMessage.count({
        where: { chatSession: { webletId: weblet.id } },
      })

      return {
        id: weblet.id,
        name: weblet.name,
        slug: weblet.slug,
        rsilEnabled: weblet.rsilEnabled,
        rsilGovernance: weblet.rsilGovernance,
        latestVersion: latestVersion
          ? {
              id: latestVersion.id,
              versionNum: latestVersion.versionNum,
              status: latestVersion.status,
              avgScore: latestVersion.avgScore,
              commitMsg: latestVersion.commitMsg,
              prompt: (activeVersion?.id === latestVersion.id ? latestVersion.prompt : activeVersion?.prompt) ?? latestVersion.prompt,
            }
          : null,
        activeTest: activeTest
          ? {
              id: activeTest.id,
              versionNum: activeTest.versionNum,
              abTestTrafficPct: activeTest.abTestTrafficPct,
              abTestStartedAt: activeTest.abTestStartedAt,
            }
          : null,
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
