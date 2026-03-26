import { describe, expect, it } from 'vitest'

import {
  OPTIMIZATION_REVIEW_EVENT_TYPE,
  parseOptimizationReviewData,
} from '@/lib/rsil/optimization-review'

describe('parseOptimizationReviewData', () => {
  it('returns parsed review metadata for valid optimization review payloads', () => {
    const result = parseOptimizationReviewData({
      sourceVersionId: 'version_source',
      sourceVersionNum: 2,
      sourcePrompt: 'Old prompt',
      optimizedVersionId: 'version_draft',
      optimizedVersionNum: 3,
      optimizedPrompt: 'New prompt',
      changelog: 'Improved clarity and guardrails',
    })

    expect(result).toEqual({
      sourceVersionId: 'version_source',
      sourceVersionNum: 2,
      sourcePrompt: 'Old prompt',
      optimizedVersionId: 'version_draft',
      optimizedVersionNum: 3,
      optimizedPrompt: 'New prompt',
      changelog: 'Improved clarity and guardrails',
    })
  })

  it('returns null when required fields are missing', () => {
    const result = parseOptimizationReviewData({
      sourceVersionId: 'version_source',
      optimizedVersionId: 'version_draft',
    })

    expect(result).toBeNull()
  })

  it('exposes a stable analytics event type for optimization review persistence', () => {
    expect(OPTIMIZATION_REVIEW_EVENT_TYPE).toBe('RSIL_OPTIMIZATION_REVIEW')
  })
})
