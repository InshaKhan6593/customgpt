import { NextRequest, NextResponse } from 'next/server'
import { subHours } from 'date-fns'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { fetchScoreMetrics, type ScoreMetric, type ScoreTimeSeries } from '@/lib/langfuse/client'
import { prisma } from '@/lib/prisma'
import { analyzeWeblet, type AnalysisResult } from '@/lib/rsil/analyzer'

const querySchema = z.object({
  webletId: z.string().min(1),
  hours: z.coerce.number().int().min(1).max(24 * 30).optional().default(24),
})

const ANALYZE_WEBLET_TIMEOUT_MS = 6000
const FETCH_SCORE_METRICS_TIMEOUT_MS = 4000

const DEFAULT_WEBLET_ANALYSIS: AnalysisResult = {
  decision: 'NONE',
  compositeScore: 0,
  avgScore: 0,
  sampleSize: 0,
  lowScoredTraceIds: [],
  dimensions: [],
  weakDimensions: [],
  reason: 'Timed out or failed to analyze weblet',
}

const DEFAULT_SCORE_METRICS: { dimensions: ScoreMetric[]; timeSeries: ScoreTimeSeries[] } = {
  dimensions: [],
  timeSeries: [],
}

async function withTimeoutFallback<T>(
  operation: Promise<T>,
  timeoutMs: number,
  fallback: T,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const timedOperation = Promise.race([
      operation.then((value) => ({ type: 'success' as const, value })),
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(fallback)
        }, timeoutMs)
      }).then((value) => ({ type: 'timeout' as const, value })),
    ])

    const result = await timedOperation
    if (result.type === 'timeout') {
      console.warn(`[rsil/scores] ${label} timed out after ${timeoutMs}ms`)
    }

    return result.value
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    console.warn(`[rsil/scores] ${label} failed: ${message}`)
    return fallback
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const parsed = querySchema.safeParse({
      webletId: req.nextUrl.searchParams.get("webletId"),
      hours: req.nextUrl.searchParams.get("hours") ?? 24,
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

    const fromTimestamp = subHours(new Date(), hours).toISOString()
    const analysis = await withTimeoutFallback(
      analyzeWeblet(webletId, hours),
      ANALYZE_WEBLET_TIMEOUT_MS,
      DEFAULT_WEBLET_ANALYSIS,
      `analyzeWeblet(${webletId})`
    )
    const metrics = await withTimeoutFallback(
      fetchScoreMetrics({
        webletId,
        fromTimestamp,
        granularity: hours <= 24 ? 'hour' : hours <= 168 ? 'day' : 'week',
      }),
      FETCH_SCORE_METRICS_TIMEOUT_MS,
      DEFAULT_SCORE_METRICS,
      `fetchScoreMetrics(${webletId})`
    )
    const recentRatings = await prisma.analyticsEvent.findMany({
      where: {
        webletId,
        eventType: { in: ['user_rating', 'thumbs_up', 'thumbs_down'] },
        createdAt: { gte: new Date(fromTimestamp) },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({
      analysis,
      recentRatings,
      metrics,
    })
  } catch (error) {
    console.error('RSIL scores error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
