/**
 * RSIL Analyzer — queries Langfuse scores for a weblet and decides what action to take.
 *
 * Consumes two signal types:
 * 1. User ratings    — "user-rating" scores (1–5), pushed when users thumbs-up/down
 * 2. LLM-as-a-Judge — scores created automatically by Langfuse evaluators
 *    Supported: helpfulness, correctness, hallucination, toxicity, conciseness
 *    Configure evaluators in Langfuse UI → Evaluations → LLM-as-a-judge
 *
 * All signals are normalized to 0–1 and blended into a composite score.
 * Decision matrix (on composite, mapped back to 0–5 scale):
 *   composite >= 0.8 → NONE
 *   composite >= 0.6 → SUGGESTION
 *   composite <  0.6 → AUTO_UPDATE
 */

import { fetchScores } from '@/lib/langfuse/client'

export type RSILDecision = 'NONE' | 'SUGGESTION' | 'AUTO_UPDATE'

export interface ScoreDimension {
  name: string
  avgValue: number      // normalized 0–1
  sampleSize: number
  weight: number
}

export interface AnalysisResult {
  decision: RSILDecision
  compositeScore: number      // 0–1, weighted blend of all signals
  avgScore: number            // legacy: composite mapped to 0–5 for compatibility
  sampleSize: number
  lowScoredTraceIds: string[]
  dimensions: ScoreDimension[]
  weakDimensions: string[]    // dimension names scoring below 0.6 — passed to generator
  reason: string
}

/**
 * Score configuration for known Langfuse score types.
 * max:            the maximum value the score can take
 * higherIsBetter: true for helpfulness/correctness; false for hallucination/toxicity
 * weight:         relative weight in the composite (will be re-normalized if some signals are absent)
 */
const SCORE_CONFIGS: Record<string, { max: number; higherIsBetter: boolean; weight: number }> = {
  'user-rating':   { max: 5, higherIsBetter: true,  weight: 0.50 },
  'helpfulness':   { max: 1, higherIsBetter: true,  weight: 0.20 },
  'correctness':   { max: 1, higherIsBetter: true,  weight: 0.15 },
  'hallucination': { max: 1, higherIsBetter: false, weight: 0.10 },
  'toxicity':      { max: 1, higherIsBetter: false, weight: 0.03 },
  'conciseness':   { max: 1, higherIsBetter: true,  weight: 0.02 },
}

/** Normalize a raw score value to 0–1 based on its config */
function normalize(value: number, config: { max: number; higherIsBetter: boolean }): number {
  const ratio = Math.min(Math.max(value / config.max, 0), 1)
  return config.higherIsBetter ? ratio : 1 - ratio
}

export async function analyzeWeblet(webletId: string, lookbackHours = 24): Promise<AnalysisResult> {
  const fromTimestamp = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  // Fetch all scores (user + LLM-as-a-Judge) — filter by webletId tag server-side
  const data = await fetchScores({ webletId, fromTimestamp, limit: 500 })
  const allScores: Array<{ traceId: string; name: string; value: number }> =
    (data?.data || []).filter((s: any) => typeof s.value === 'number')

  if (allScores.length === 0) {
    return {
      decision: 'NONE',
      compositeScore: 1,
      avgScore: 5,
      sampleSize: 0,
      lowScoredTraceIds: [],
      dimensions: [],
      weakDimensions: [],
      reason: 'No scores collected yet',
    }
  }

  // Group scores by dimension name
  const byDimension: Record<string, Array<{ traceId: string; normalizedValue: number }>> = {}

  for (const score of allScores) {
    const config = SCORE_CONFIGS[score.name]
    if (!config) continue // ignore unknown score names

    const norm = normalize(score.value, config)
    if (!byDimension[score.name]) byDimension[score.name] = []
    byDimension[score.name].push({ traceId: score.traceId, normalizedValue: norm })
  }

  // Compute per-dimension averages
  const dimensions: ScoreDimension[] = []
  let totalWeight = 0

  for (const [name, entries] of Object.entries(byDimension)) {
    const config = SCORE_CONFIGS[name]
    const avgValue = entries.reduce((sum, e) => sum + e.normalizedValue, 0) / entries.length
    dimensions.push({ name, avgValue, sampleSize: entries.length, weight: config.weight })
    totalWeight += config.weight
  }

  // Compute weighted composite (re-normalize weights to account for absent dimensions)
  let compositeScore = 0
  for (const dim of dimensions) {
    compositeScore += (dim.avgValue * dim.weight) / totalWeight
  }

  // Collect trace IDs where any dimension scored poorly (normalized < 0.5)
  const lowScoredTraceIdSet = new Set<string>()
  for (const entries of Object.values(byDimension)) {
    for (const e of entries) {
      if (e.normalizedValue < 0.5) lowScoredTraceIdSet.add(e.traceId)
    }
  }

  const weakDimensions = dimensions
    .filter(d => d.avgValue < 0.6)
    .sort((a, b) => a.avgValue - b.avgValue)
    .map(d => d.name)

  // Map composite (0–1) back to 0–5 for legacy compatibility
  const avgScore = compositeScore * 5

  let decision: RSILDecision
  let reason: string

  if (compositeScore >= 0.8) {
    decision = 'NONE'
    reason = `Composite score ${(compositeScore * 100).toFixed(0)}% — performing well`
  } else if (compositeScore >= 0.6) {
    decision = 'SUGGESTION'
    reason = `Composite score ${(compositeScore * 100).toFixed(0)}% — weak on: ${weakDimensions.join(', ') || 'general quality'}`
  } else {
    decision = 'AUTO_UPDATE'
    reason = `Composite score ${(compositeScore * 100).toFixed(0)}% — auto-optimize triggered (weak: ${weakDimensions.join(', ') || 'general quality'})`
  }

  return {
    decision,
    compositeScore,
    avgScore,
    sampleSize: allScores.length,
    lowScoredTraceIds: Array.from(lowScoredTraceIdSet),
    dimensions,
    weakDimensions,
    reason,
  }
}
