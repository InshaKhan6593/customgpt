export const OPTIMIZATION_REVIEW_EVENT_TYPE = 'RSIL_OPTIMIZATION_REVIEW'

export type OptimizationReviewData = {
  sourceVersionId: string
  sourceVersionNum: number
  sourcePrompt: string
  optimizedVersionId: string
  optimizedVersionNum: number
  optimizedPrompt: string
  changelog: string
}

export function isOptimizationReviewData(value: unknown): value is OptimizationReviewData {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>

  return typeof candidate.sourceVersionId === 'string'
    && typeof candidate.sourceVersionNum === 'number'
    && typeof candidate.sourcePrompt === 'string'
    && typeof candidate.optimizedVersionId === 'string'
    && typeof candidate.optimizedVersionNum === 'number'
    && typeof candidate.optimizedPrompt === 'string'
    && typeof candidate.changelog === 'string'
}

export function parseOptimizationReviewData(value: unknown): OptimizationReviewData | null {
  return isOptimizationReviewData(value) ? value : null
}
