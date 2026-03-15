/**
 * RSIL Analyzer — queries Langfuse scores for a weblet and decides what action to take.
 *
 * Decision matrix:
 * - avg score >= 4.0 → NONE
 * - avg score 3.0–3.9 → SUGGESTION (queue for creator review)
 * - avg score < 3.0 → AUTO_UPDATE (trigger A/B test)
 */

import { fetchScores } from '@/lib/langfuse/client'

export type RSILDecision = 'NONE' | 'SUGGESTION' | 'AUTO_UPDATE'

export interface AnalysisResult {
  decision: RSILDecision
  avgScore: number
  sampleSize: number
  lowScoredTraceIds: string[]
  reason: string
}

export async function analyzeWeblet(webletId: string, lookbackHours = 24): Promise<AnalysisResult> {
  const fromTimestamp = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  const data = await fetchScores({ webletId, fromTimestamp, limit: 100 })
  const scores: Array<{ traceId: string; value: number }> = (data?.data || [])
    .filter((s: any) => s.name === 'user-rating' && typeof s.value === 'number')

  if (scores.length === 0) {
    return {
      decision: 'NONE',
      avgScore: 0,
      sampleSize: 0,
      lowScoredTraceIds: [],
      reason: 'No ratings collected yet',
    }
  }

  const avgScore = scores.reduce((sum, s) => sum + s.value, 0) / scores.length
  const lowScoredTraceIds = scores.filter(s => s.value <= 2).map(s => s.traceId)

  let decision: RSILDecision
  let reason: string

  if (avgScore >= 4.0) {
    decision = 'NONE'
    reason = `Avg score ${avgScore.toFixed(2)} — performing well`
  } else if (avgScore >= 3.0) {
    decision = 'SUGGESTION'
    reason = `Avg score ${avgScore.toFixed(2)} — suggest improvements`
  } else {
    decision = 'AUTO_UPDATE'
    reason = `Avg score ${avgScore.toFixed(2)} — auto-optimize triggered`
  }

  return { decision, avgScore, sampleSize: scores.length, lowScoredTraceIds, reason }
}
