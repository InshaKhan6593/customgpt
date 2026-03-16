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

    const items = weblets.map(weblet => {
      const latestVersion = weblet.versions[0] ?? null
      const activeTest = weblet.versions.find(version => version.status === "TESTING" && version.isAbTest)

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
      }
    })

    return NextResponse.json({ weblets: items })
  } catch (error) {
    console.error("RSIL overview error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
