import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { analyzeWeblet } from "@/lib/rsil/analyzer"

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

    const analysisResults = await Promise.allSettled(
      weblets.map(async (weblet) => {
        const analysis = await analyzeWeblet(weblet.id, 168)
        return { webletId: weblet.id, analysis }
      })
    )

    const perWebletScores = await Promise.all(
      weblets.map(async (weblet, index) => {
        const resultObj = analysisResults[index]

        const analysis =
          resultObj.status === "fulfilled"
            ? resultObj.value.analysis
            : {
                decision: "NONE" as const,
                compositeScore: 0,
                dimensions: [],
                sampleSize: 0,
              }

        const interactionCount = await prisma.chatMessage.count({
          where: { chatSession: { webletId: weblet.id } },
        })

        return {
          webletId: weblet.id,
          webletName: weblet.name,
          compositeScore: analysis.compositeScore,
          dimensions: analysis.dimensions,
          interactionCount,
          decision: analysis.decision,
        }
      })
    )

    const totalWeblets = weblets.length
    const totalInteractions = perWebletScores.reduce((sum, w) => sum + w.interactionCount, 0)

    const webletScores = perWebletScores.map((w) => w.compositeScore).filter((s) => s > 0)
    const avgCompositeScore = webletScores.length > 0
      ? webletScores.reduce((sum, s) => sum + s, 0) / webletScores.length
      : 0

    const webletOverviews = weblets.map((weblet) => ({
      id: weblet.id,
      name: weblet.name,
      slug: weblet.slug,
      rsilEnabled: weblet.rsilEnabled,
    }))

    return NextResponse.json({
      weblets: webletOverviews,
      aggregateStats: {
        totalWeblets,
        totalInteractions,
        avgCompositeScore,
      },
      perWebletScores,
    })
  } catch (error) {
    console.error("RSIL aggregate error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
