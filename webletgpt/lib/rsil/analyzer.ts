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
  warning?: string
}

interface AnalyzeParams {
  webletId: string
  versionId?: string
  lookbackHours?: number
}

const HOURS_TO_MS = 60 * 60 * 1000
const DEFAULT_LOOKBACK_HOURS = 24
const SCORE_FETCH_LIMIT = 500
const EMPTY_COMPOSITE_SCORE = 1
const LEGACY_SCORE_SCALE_MAX = 5
const SCORE_SCALE_MAX_BINARY = 1
const USER_RATING_WEIGHT = 0.30
const HELPFULNESS_WEIGHT = 0.20
const CORRECTNESS_WEIGHT = 0.15
const CONTEXT_RELEVANCE_WEIGHT = 0.15
const HALLUCINATION_WEIGHT = 0.10
const TOXICITY_WEIGHT = 0.05
const CONCISENESS_WEIGHT = 0.05

const LOW_SCORE_TRACE_THRESHOLD = 0.5
const WEAK_DIMENSION_THRESHOLD = 0.6
const NO_ACTION_THRESHOLD = 0.8
const PERCENT_SCALE = 100

/**
 * Score configuration for known Langfuse score types.
 * max:            the maximum value the score can take
 * higherIsBetter: true for helpfulness/correctness; false for hallucination/toxicity
 * weight:         relative weight in the composite (will be re-normalized if some signals are absent)
 */
const SCORE_CONFIGS: Record<string, { max: number; higherIsBetter: boolean; weight: number }> = {
  'user-rating':       { max: LEGACY_SCORE_SCALE_MAX, higherIsBetter: true,  weight: USER_RATING_WEIGHT },
  'helpfulness':       { max: SCORE_SCALE_MAX_BINARY, higherIsBetter: true,  weight: HELPFULNESS_WEIGHT },
  'correctness':       { max: SCORE_SCALE_MAX_BINARY, higherIsBetter: true,  weight: CORRECTNESS_WEIGHT },
  'context-relevance': { max: SCORE_SCALE_MAX_BINARY, higherIsBetter: true,  weight: CONTEXT_RELEVANCE_WEIGHT },
  'hallucination':     { max: SCORE_SCALE_MAX_BINARY, higherIsBetter: false, weight: HALLUCINATION_WEIGHT },
  'toxicity':          { max: SCORE_SCALE_MAX_BINARY, higherIsBetter: false, weight: TOXICITY_WEIGHT },
  'conciseness':       { max: SCORE_SCALE_MAX_BINARY, higherIsBetter: true,  weight: CONCISENESS_WEIGHT },
}

/** Normalize a raw score value to 0–1 based on its config */
function normalize(value: number, config: { max: number; higherIsBetter: boolean }): number {
  const ratio = Math.min(Math.max(value / config.max, 0), 1)
  return config.higherIsBetter ? ratio : 1 - ratio
}

export async function analyzeWeblet(webletId: string, lookbackHours = DEFAULT_LOOKBACK_HOURS): Promise<AnalysisResult> {
  return analyze({ webletId, lookbackHours })
}

export async function analyzeVersion(webletId: string, versionId: string, lookbackHours = DEFAULT_LOOKBACK_HOURS): Promise<AnalysisResult> {
  return analyze({ webletId, versionId, lookbackHours })
}

export async function analyze({ webletId, versionId, lookbackHours = DEFAULT_LOOKBACK_HOURS }: AnalyzeParams): Promise<AnalysisResult> {
  const fromTimestamp = new Date(Date.now() - lookbackHours * HOURS_TO_MS).toISOString()

  const data = await fetchScores({ webletId, versionId, fromTimestamp, limit: SCORE_FETCH_LIMIT })
  const allScores: Array<{ traceId: string; name: string; value: number }> =
    (data?.data || []).filter((s: any) => typeof s.value === 'number')

  if (allScores.length === 0) {
    return {
      decision: 'NONE',
      compositeScore: EMPTY_COMPOSITE_SCORE,
      avgScore: LEGACY_SCORE_SCALE_MAX,
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
    const key = score.name.toLowerCase()
    const config = SCORE_CONFIGS[key]
    if (!config) continue // ignore unknown score names

    const norm = normalize(score.value, config)
    if (!byDimension[key]) byDimension[key] = []
    byDimension[key].push({ traceId: score.traceId, normalizedValue: norm })
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
  if (totalWeight > 0) {
    for (const dim of dimensions) {
      compositeScore += (dim.avgValue * dim.weight) / totalWeight
    }
  }

  const lowScoredTraceIdSet = new Set<string>()
  for (const entries of Object.values(byDimension)) {
    for (const e of entries) {
      if (e.normalizedValue < LOW_SCORE_TRACE_THRESHOLD) lowScoredTraceIdSet.add(e.traceId)
    }
  }

  const weakDimensions = dimensions
    .filter(d => d.avgValue < WEAK_DIMENSION_THRESHOLD)
    .sort((a, b) => a.avgValue - b.avgValue)
    .map(d => d.name)

  const warning = dimensions.length > 0 && dimensions.every(d => d.name === 'user-rating')
    ? 'Only user-rating scores found. Configure LLM-as-a-Judge evaluators in Langfuse.'
    : undefined

  const avgScore = compositeScore * LEGACY_SCORE_SCALE_MAX

  let decision: RSILDecision
  let reason: string

  if (compositeScore >= NO_ACTION_THRESHOLD) {
    decision = 'NONE'
    reason = `Composite score ${(compositeScore * PERCENT_SCALE).toFixed(0)}% — performing well`
  } else if (compositeScore >= WEAK_DIMENSION_THRESHOLD) {
    decision = 'SUGGESTION'
    reason = `Composite score ${(compositeScore * PERCENT_SCALE).toFixed(0)}% — weak on: ${weakDimensions.join(', ') || 'general quality'}`
  } else {
    decision = 'AUTO_UPDATE'
    reason = `Composite score ${(compositeScore * PERCENT_SCALE).toFixed(0)}% — auto-optimize triggered (weak: ${weakDimensions.join(', ') || 'general quality'})`
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
    warning,
  }
}
