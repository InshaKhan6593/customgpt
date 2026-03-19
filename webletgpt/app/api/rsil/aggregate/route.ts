import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { fetchScoreMetrics } from "@/lib/langfuse/client"
import { prisma } from "@/lib/prisma"
import { analyzeWeblet } from "@/lib/rsil/analyzer"

type TrendPoint = {
  date: string
  score: number
}

type OptimizationActivityPoint = {
  week: string
  count: number
}

function getWeekStartUtc(date: Date): Date {
  const weekStart = new Date(date)
  const day = weekStart.getUTCDay()
  const diffToMonday = (day + 6) % 7
  weekStart.setUTCDate(weekStart.getUTCDate() - diffToMonday)
  weekStart.setUTCHours(0, 0, 0, 0)
  return weekStart
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildTrendData(timeSeries: Array<{ date: string; [key: string]: number | string }>): TrendPoint[] {
  return timeSeries
    .map((entry) => {
      const numericValues = Object.entries(entry)
        .filter((pair): pair is [string, number] => pair[0] !== "date" && typeof pair[1] === "number")
        .map(([, value]) => value)

      const score =
        numericValues.length > 0
          ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
          : 0

      return {
        date: entry.date,
        score,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildOptimizationActivity(createdAtRows: Array<{ createdAt: Date }>): OptimizationActivityPoint[] {
  const now = new Date()
  const currentWeekStart = getWeekStartUtc(now)
  const weekStarts = Array.from({ length: 8 }, (_, index) => {
    const weekStart = new Date(currentWeekStart)
    weekStart.setUTCDate(currentWeekStart.getUTCDate() - (7 - index) * 7)
    return weekStart
  })

  const countsByWeek = new Map<string, number>()

  for (const row of createdAtRows) {
    const week = formatUtcDate(getWeekStartUtc(row.createdAt))
    countsByWeek.set(week, (countsByWeek.get(week) ?? 0) + 1)
  }

  return weekStarts.map((weekStart) => {
    const week = formatUtcDate(weekStart)
    return {
      week,
      count: countsByWeek.get(week) ?? 0,
    }
  })
}

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

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000)

    const [
      analysisResultsSettled,
      activeABTestCountSettled,
      optimizations30dCountSettled,
      trendDataSettled,
      optimizationVersionRowsSettled,
    ] = await Promise.allSettled([
      Promise.allSettled(
        weblets.map(async (weblet) => {
          const analysis = await analyzeWeblet(weblet.id, 168)
          return { webletId: weblet.id, analysis }
        })
      ),
      prisma.webletVersion.count({
        where: {
          status: "TESTING",
          isAbTest: true,
          weblet: { developerId, rsilEnabled: true },
        },
      }),
      prisma.webletVersion.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          weblet: { developerId, rsilEnabled: true },
          OR: [{ isAbTest: true }, { abTestWinner: true }],
        },
      }),
      (async () => {
        if (weblets.length === 0) {
          return [] as TrendPoint[]
        }

        const allMetrics = await Promise.all(
          weblets.map((w) =>
            fetchScoreMetrics({
              webletId: w.id,
              fromTimestamp: sevenDaysAgoIso,
              granularity: "day",
            })
          )
        )

        const allPoints = allMetrics.flatMap((m) => buildTrendData(m.timeSeries))

        const byDate = new Map<string, number[]>()
        for (const point of allPoints) {
          const arr = byDate.get(point.date) ?? []
          arr.push(point.score)
          byDate.set(point.date, arr)
        }

        return Array.from(byDate.entries())
          .map(([date, scores]) => ({
            date,
            score: scores.reduce((sum, s) => sum + s, 0) / scores.length,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      })(),
      prisma.webletVersion.findMany({
        where: {
          createdAt: { gte: eightWeeksAgo },
          weblet: { developerId, rsilEnabled: true },
          OR: [{ isAbTest: true }, { abTestWinner: true }],
        },
        select: { createdAt: true },
      }),
    ])

    const analysisResults =
      analysisResultsSettled.status === "fulfilled" ? analysisResultsSettled.value : []

    const activeABTestCount =
      activeABTestCountSettled.status === "fulfilled" ? activeABTestCountSettled.value : 0

    const optimizations30dCount =
      optimizations30dCountSettled.status === "fulfilled" ? optimizations30dCountSettled.value : 0

    const trendData = trendDataSettled.status === "fulfilled" ? trendDataSettled.value : []

    const optimizationActivity =
      optimizationVersionRowsSettled.status === "fulfilled"
        ? buildOptimizationActivity(optimizationVersionRowsSettled.value)
        : []

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
      activeABTestCount,
      optimizations30dCount,
      trendData,
      optimizationActivity,
      perWebletScores,
    })
  } catch (error) {
    console.error("RSIL aggregate error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
