import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const querySchema = z.object({
  webletId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
})

const RSIL_NOTIFICATION_EVENT_TYPES = [
  'rsil.approval-required',
  'rsil.ab-test-concluded',
  'rsil.rollback-triggered',
  'rsil.canary-advanced',
] as const

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const parsed = querySchema.safeParse({
      webletId: req.nextUrl.searchParams.get('webletId') ?? undefined,
      limit: req.nextUrl.searchParams.get('limit') ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
    }

    const { webletId, limit } = parsed.data

    const where = {
      eventType: { in: [...RSIL_NOTIFICATION_EVENT_TYPES] },
      weblet: {
        developerId,
        ...(webletId ? { id: webletId } : {}),
      },
    }

    const [notifications, count] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          webletId: true,
          eventType: true,
          eventData: true,
          createdAt: true,
        },
      }),
      prisma.analyticsEvent.count({ where }),
    ])

    return NextResponse.json({ notifications, count })
  } catch (error) {
    console.error('RSIL notifications GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
