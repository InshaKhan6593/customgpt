import { NextRequest, NextResponse } from 'next/server'
import { subHours } from 'date-fns'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { fetchScoresByPromptVersion } from '@/lib/langfuse/client'
import { prisma } from '@/lib/prisma'

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
      webletId: req.nextUrl.searchParams.get('webletId'),
      hours: req.nextUrl.searchParams.get('hours') ?? 24,
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
    const promptVersionScores = await fetchScoresByPromptVersion({
      webletId,
      fromTimestamp,
    })

    return NextResponse.json({ promptVersionScores })
  } catch (error) {
    console.error('RSIL prompt scores error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
