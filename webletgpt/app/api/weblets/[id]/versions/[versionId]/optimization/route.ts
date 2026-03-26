import { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
  OPTIMIZATION_REVIEW_EVENT_TYPE,
  parseOptimizationReviewData,
} from '@/lib/rsil/optimization-review'
import { errorResponse, successResponse } from '@/lib/utils/api-response'
import { requireRole } from '@/lib/utils/auth-guard'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params
    const user = await requireRole('DEVELOPER')

    const weblet = await prisma.weblet.findUnique({ where: { id } })
    if (!weblet) return errorResponse('Weblet not found', 404)
    if (weblet.developerId !== user.id) return errorResponse('Forbidden', 403)

    const version = await prisma.webletVersion.findFirst({
      where: { id: versionId, webletId: id },
      select: {
        id: true,
        versionNum: true,
        status: true,
        createdAt: true,
      },
    })

    if (!version) return errorResponse('Version not found', 404)

    const event = await prisma.analyticsEvent.findFirst({
      where: {
        webletId: id,
        eventType: OPTIMIZATION_REVIEW_EVENT_TYPE,
      },
      orderBy: { createdAt: 'desc' },
    })

    const review = parseOptimizationReviewData(event?.eventData)
    if (!review || review.optimizedVersionId !== versionId) {
      return errorResponse('Optimization review not found', 404)
    }

    return successResponse({
      version,
      review,
    })
  } catch (err: any) {
    if (err.name === 'AuthorizationError') return errorResponse(err.message, 403)
    return errorResponse('Internal server error', 500)
  }
}
