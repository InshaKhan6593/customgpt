import { NextRequest, NextResponse } from 'next/server'
import { subHours } from 'date-fns'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { fetchScoreMetrics } from '@/lib/langfuse/client'
import { prisma } from '@/lib/prisma'
import { analyzeWeblet } from '@/lib/rsil/analyzer'

const querySchema = z.object({
  webletId: z.string().min(1),
  hours: z.coerce.number().int().min(1).max(24 * 30).optional().default(24),
})

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
    const analysis = await analyzeWeblet(webletId, hours)
    const metrics = await fetchScoreMetrics({
      webletId,
      fromTimestamp,
      granularity: hours <= 24 ? 'hour' : hours <= 168 ? 'day' : 'week',
    })
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
