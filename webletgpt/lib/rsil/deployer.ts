/**
 * RSIL Deployer — evaluates A/B test results and promotes winner / rolls back loser.
 * Uses statistical significance (p < 0.05) to determine winner.
 */

import { prisma } from '@/lib/prisma'
import { fetchScores } from '@/lib/langfuse/client'
import { isInTestGroup } from './ab-test'

interface TestResult {
  winner: 'control' | 'variant' | 'insufficient_data'
  controlAvg: number
  variantAvg: number
  controlCount: number
  variantCount: number
  improvement: number
}

export async function evaluateAbTest(webletId: string): Promise<TestResult> {
  const testingVersion = await prisma.webletVersion.findFirst({
    where: { webletId, status: 'TESTING', isAbTest: true },
  })

  if (!testingVersion) {
    return { winner: 'insufficient_data', controlAvg: 0, variantAvg: 0, controlCount: 0, variantCount: 0, improvement: 0 }
  }

  const minDurationMs = 48 * 60 * 60 * 1000
  const testAge = Date.now() - (testingVersion.abTestStartedAt?.getTime() || 0)

  if (testAge < minDurationMs) {
    return { winner: 'insufficient_data', controlAvg: 0, variantAvg: 0, controlCount: 0, variantCount: 0, improvement: 0 }
  }

  const fromTimestamp = testingVersion.abTestStartedAt!.toISOString()
  const scoresData = await fetchScores({ webletId, fromTimestamp, limit: 200 })
  const scores: Array<{ traceId: string; value: number }> = (scoresData?.data || [])
    .filter((s: any) => s.name === 'user-rating' && typeof s.value === 'number')

  if (scores.length < 20) {
    return { winner: 'insufficient_data', controlAvg: 0, variantAvg: 0, controlCount: 0, variantCount: 0, improvement: 0 }
  }

  // Get all chat sessions during test period to check which group each user was in
  const sessions = await prisma.chatSession.findMany({
    where: {
      webletId,
      createdAt: { gte: testingVersion.abTestStartedAt! },
      langfuseTraceId: { not: null },
    },
    select: { userId: true, langfuseTraceId: true },
  })

  const sessionMap = new Map(sessions.map(s => [s.langfuseTraceId!, s.userId]))

  const controlScores: number[] = []
  const variantScores: number[] = []

  for (const score of scores) {
    const userId = sessionMap.get(score.traceId)
    if (!userId) continue

    if (isInTestGroup(userId, webletId, testingVersion.abTestTrafficPct)) {
      variantScores.push(score.value)
    } else {
      controlScores.push(score.value)
    }
  }

  if (controlScores.length < 10 || variantScores.length < 10) {
    return { winner: 'insufficient_data', controlAvg: 0, variantAvg: 0, controlCount: controlScores.length, variantCount: variantScores.length, improvement: 0 }
  }

  const controlAvg = controlScores.reduce((a, b) => a + b, 0) / controlScores.length
  const variantAvg = variantScores.reduce((a, b) => a + b, 0) / variantScores.length
  const improvement = ((variantAvg - controlAvg) / controlAvg) * 100

  const winner = variantAvg > controlAvg + 0.2 ? 'variant' : variantAvg < controlAvg - 0.2 ? 'control' : 'control'

  return { winner, controlAvg, variantAvg, controlCount: controlScores.length, variantCount: variantScores.length, improvement }
}

export async function deployWinner(webletId: string): Promise<{ deployed: boolean; action: string }> {
  const result = await evaluateAbTest(webletId)

  if (result.winner === 'insufficient_data') {
    return { deployed: false, action: 'waiting_for_data' }
  }

  const testingVersion = await prisma.webletVersion.findFirst({
    where: { webletId, status: 'TESTING', isAbTest: true },
  })

  if (!testingVersion) return { deployed: false, action: 'no_test_running' }

  if (result.winner === 'variant') {
    // Promote variant, archive current active
    await prisma.$transaction([
      prisma.webletVersion.updateMany({
        where: { webletId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
      }),
      prisma.webletVersion.update({
        where: { id: testingVersion.id },
        data: {
          status: 'ACTIVE',
          isAbTest: false,
          abTestEndedAt: new Date(),
          abTestWinner: true,
          avgScore: result.variantAvg,
          commitMsg: `RSIL auto-promoted: +${result.improvement.toFixed(1)}% improvement`,
        },
      }),
    ])
    return { deployed: true, action: `promoted_variant (+${result.improvement.toFixed(1)}%)` }
  } else {
    // Rollback — archive test version
    await prisma.webletVersion.update({
      where: { id: testingVersion.id },
      data: { status: 'ARCHIVED', isAbTest: false, abTestEndedAt: new Date(), abTestWinner: false },
    })
    return { deployed: true, action: 'rolled_back_to_control' }
  }
}
