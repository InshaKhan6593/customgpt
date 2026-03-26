import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { prisma } from '@/lib/prisma'
import { parseOptimizationReviewData, OPTIMIZATION_REVIEW_EVENT_TYPE } from '@/lib/rsil/optimization-review'
import { requireRole } from '@/lib/utils/auth-guard'

type OptimizationReviewPageProps = {
  params: Promise<{ webletId: string; versionId: string }>
}

export default async function OptimizationReviewPage({ params }: OptimizationReviewPageProps) {
  const { webletId, versionId } = await params

  let user
  try {
    user = await requireRole('DEVELOPER')
  } catch {
    notFound()
  }

  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    select: { developerId: true },
  })

  if (!weblet || weblet.developerId !== user.id) {
    notFound()
  }

  const version = await prisma.webletVersion.findFirst({
    where: { id: versionId, webletId },
    select: {
      id: true,
      versionNum: true,
      status: true,
      createdAt: true,
    },
  })

  if (!version) {
    notFound()
  }

  const events = await prisma.analyticsEvent.findMany({
    where: {
      webletId,
      eventType: OPTIMIZATION_REVIEW_EVENT_TYPE,
    },
    orderBy: { createdAt: 'desc' },
  })

  const review = events
    .map((event) => parseOptimizationReviewData(event.eventData))
    .find((entry) => entry?.optimizedVersionId === versionId)

  if (!review) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Optimization Results</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review what changed between the source prompt and the generated draft before deploying it.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href={`/dashboard/rsil/${webletId}/deployments`}>Back to Deployments</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Draft v{review.optimizedVersionNum}</Badge>
        <Badge variant="secondary">From v{review.sourceVersionNum}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Previous Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[32rem] overflow-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
              {review.sourcePrompt}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optimized Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[32rem] overflow-auto rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
              {review.optimizedPrompt}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Why This Version Is Better</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
            {review.changelog}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
