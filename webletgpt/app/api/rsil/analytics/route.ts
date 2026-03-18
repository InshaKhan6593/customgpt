import { NextRequest, NextResponse } from 'next/server'
import { subHours } from 'date-fns'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { fetchScores, fetchScoreMetrics } from '@/lib/langfuse/client'
import { prisma } from '@/lib/prisma'
import type {
  VersionComparisonData,
  ScoreDistributionData,
  ScoreDistributionBucket,
  PerformanceTrendPoint,
} from '@/components/rsil/types'

const querySchema = z.object({
  webletId: z.string().min(1),
  hours: z.coerce.number().int().min(1).max(720).optional().default(168),
})

const analyticsCache = new Map<string, { data: unknown; expiresAt: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const parsed = querySchema.safeParse({
      webletId: req.nextUrl.searchParams.get('webletId'),
      hours: req.nextUrl.searchParams.get('hours') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
    }

    const { webletId, hours } = parsed.data

    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: 'Weblet not found' }, { status: 404 })
    }

    const cacheKey = `${webletId}-${hours}`
    const cached = analyticsCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data)
    }

    const fromTimestamp = subHours(new Date(), hours).toISOString()
    const granularity = hours <= 24 ? 'hour' : hours <= 168 ? 'day' : 'week'

    const versions = await prisma.webletVersion.findMany({
      where: { webletId },
      orderBy: { versionNum: 'desc' },
      take: 10,
      select: { id: true, versionNum: true, status: true },
    })

    let versionComparison: VersionComparisonData[] = []
    let scoreDistribution: ScoreDistributionData[] = []
    let performanceTrend: PerformanceTrendPoint[] = []

    try {
      const [allVersionScores, metricsResult] = await Promise.all([
        Promise.all(
          versions.map(v =>
            fetchScores({ webletId, versionId: v.id, limit: 200, fromTimestamp })
              .then(res => ({ version: v, scores: res.data }))
          )
        ),
        fetchScoreMetrics({ webletId, fromTimestamp, granularity }),
      ])

      versionComparison = allVersionScores
        .filter(({ scores }) => scores.length > 0)
        .map(({ version, scores }) => {
          const avgScore =
            scores.length > 0
              ? scores.reduce((sum, s) => sum + s.value, 0) / scores.length
              : 0

          const byName: Record<string, number[]> = {}
          for (const s of scores) {
            if (!byName[s.name]) byName[s.name] = []
            byName[s.name].push(s.value)
          }

          const dimensions = Object.entries(byName).map(([name, vals]) => ({
            name,
            avgValue: vals.reduce((a, b) => a + b, 0) / vals.length,
            sampleSize: vals.length,
            weight: 0, // weight is defined in analyzer.ts, not needed here
          }))

          return {
            versionId: version.id,
            versionNum: version.versionNum,
            status: version.status,
            avgScore: Math.round(avgScore * 1000) / 1000,
            sampleSize: scores.length,
            dimensions,
          }
        })

      const userRatingScores = allVersionScores.flatMap(({ scores }) =>
        scores.filter(s => s.name === 'user-rating')
      )

      if (userRatingScores.length > 0) {
        const buckets: ScoreDistributionBucket[] = [
          { range: '1-2 (Poor)', count: 0, percentage: 0 },
          { range: '2-3 (Fair)', count: 0, percentage: 0 },
          { range: '3-4 (Good)', count: 0, percentage: 0 },
          { range: '4-5 (Excellent)', count: 0, percentage: 0 },
        ]

        for (const s of userRatingScores) {
          if (s.value < 2) buckets[0].count++
          else if (s.value < 3) buckets[1].count++
          else if (s.value < 4) buckets[2].count++
          else buckets[3].count++
        }

        const total = userRatingScores.length
        for (const b of buckets) {
          b.percentage = total > 0 ? Math.round((b.count / total) * 100) : 0
        }

        const sorted = [...userRatingScores].sort((a, b) => a.value - b.value)
        const mean =
          userRatingScores.reduce((s, r) => s + r.value, 0) / userRatingScores.length
        const mid = Math.floor(sorted.length / 2)
        const median =
          sorted.length % 2 === 0
            ? (sorted[mid - 1].value + sorted[mid].value) / 2
            : sorted[mid].value

        scoreDistribution = [
          {
            scoreName: 'user-rating',
            buckets,
            mean: Math.round(mean * 100) / 100,
            median: Math.round(median * 100) / 100,
          },
        ]
      }

      performanceTrend = metricsResult.timeSeries.map(point => {
        const entry: PerformanceTrendPoint = { date: point.date as string, composite: 0 }
        let compositeSum = 0
        let compositeCount = 0
        for (const [key, val] of Object.entries(point)) {
          if (key !== 'date' && typeof val === 'number') {
            entry[key] = val
            compositeSum += val
            compositeCount++
          }
        }
        entry.composite =
          compositeCount > 0
            ? Math.round((compositeSum / compositeCount) * 1000) / 1000
            : 0
        return entry
      })
    } catch (error) {
      console.warn('[rsil/analytics] Langfuse fetch failed:', error)
    }

    const responseData = {
      versionComparison,
      scoreDistribution,
      performanceTrend,
      lastUpdated: new Date().toISOString(),
    }

    analyticsCache.set(cacheKey, { data: responseData, expiresAt: Date.now() + CACHE_TTL })

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[rsil/analytics] Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
