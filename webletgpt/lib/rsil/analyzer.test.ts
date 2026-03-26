import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { getScoreConfigs } from './analyzer'
import { DEFAULT_EVALUATOR_CONFIG, type EvaluatorConfig } from './governance'

const mockFetchScores = mock(async () => ({ data: [] }))

mock.module('@/lib/langfuse/client', () => ({
  fetchScores: mockFetchScores,
}))

const { analyzeVersion, analyzeWeblet } = await import('./analyzer')

describe('getScoreConfigs', () => {
  it('always includes user-rating with weight 0.30', () => {
    const configs = getScoreConfigs()
    expect(configs['user-rating']).toEqual({ max: 5, higherIsBetter: true, weight: 0.30 })
  })

  it('always includes all three base evaluators', () => {
    const configs = getScoreConfigs()
    expect(configs['helpfulness']).toBeDefined()
    expect(configs['correctness']).toBeDefined()
    expect(configs['hallucination']).toBeDefined()
  })

  it('base evaluators have correct higherIsBetter values from EVALUATOR_PROMPTS', () => {
    const configs = getScoreConfigs()
    expect(configs['helpfulness'].higherIsBetter).toBe(true)
    expect(configs['correctness'].higherIsBetter).toBe(true)
    expect(configs['hallucination'].higherIsBetter).toBe(false)
  })

  it('converts base evaluator weights from percentages to decimals', () => {
    const configs = getScoreConfigs()
    expect(configs['helpfulness'].weight).toBeCloseTo(0.20)
    expect(configs['correctness'].weight).toBeCloseTo(0.15)
    expect(configs['hallucination'].weight).toBeCloseTo(0.10)
  })

  it('includes enabled optional evaluators from DEFAULT_EVALUATOR_CONFIG', () => {
    const configs = getScoreConfigs()
    expect(configs['toxicity']).toBeDefined()
    expect(configs['conciseness']).toBeDefined()
    expect(configs['context-relevance']).toBeDefined()
  })

  it('excludes disabled optional evaluators', () => {
    const configs = getScoreConfigs()
    expect(configs['context-correctness']).toBeUndefined()
    expect(configs['faithfulness']).toBeUndefined()
    expect(configs['answer-relevance']).toBeUndefined()
  })

  it('weights sum to 1.0 with DEFAULT_EVALUATOR_CONFIG', () => {
    const configs = getScoreConfigs()
    const total = Object.values(configs).reduce((sum, c) => sum + c.weight, 0)
    expect(total).toBeCloseTo(1.0, 5)
  })

  it('uses DEFAULT_EVALUATOR_CONFIG when called with undefined', () => {
    const withUndefined = getScoreConfigs(undefined)
    const withDefault = getScoreConfigs(DEFAULT_EVALUATOR_CONFIG)
    expect(withUndefined).toEqual(withDefault)
  })

  it('excludes disabled optional evaluators from a custom config', () => {
    const custom: EvaluatorConfig = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 20 },
        correctness: { enabled: true, weight: 15 },
        hallucination: { enabled: true, weight: 10 },
      },
      optionalEvaluators: {
        toxicity: { enabled: false, weight: 0 },
        conciseness: { enabled: false, weight: 0 },
        'context-relevance': { enabled: false, weight: 0 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }
    const configs = getScoreConfigs(custom)
    expect(configs['toxicity']).toBeUndefined()
    expect(configs['conciseness']).toBeUndefined()
    expect(Object.keys(configs)).toHaveLength(4)
  })

  it('includes newly enabled optional evaluator from custom config', () => {
    const custom: EvaluatorConfig = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 20 },
        correctness: { enabled: true, weight: 15 },
        hallucination: { enabled: true, weight: 10 },
      },
      optionalEvaluators: {
        toxicity: { enabled: false, weight: 0 },
        conciseness: { enabled: false, weight: 0 },
        'context-relevance': { enabled: false, weight: 0 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: true, weight: 25 },
      },
    }
    const configs = getScoreConfigs(custom)
    expect(configs['answer-relevance']).toBeDefined()
    expect(configs['answer-relevance'].weight).toBeCloseTo(0.25)
    expect(configs['answer-relevance'].higherIsBetter).toBe(true)
  })

  it('optional evaluators have correct higherIsBetter values', () => {
    const configs = getScoreConfigs()
    expect(configs['toxicity'].higherIsBetter).toBe(false)
    expect(configs['conciseness'].higherIsBetter).toBe(true)
    expect(configs['context-relevance'].higherIsBetter).toBe(true)
  })
})

describe('analyzeVersion with evaluatorConfig', () => {
  beforeEach(() => {
    mockFetchScores.mockReset()
  })

  it('returns NONE with no scores regardless of config', async () => {
    mockFetchScores.mockResolvedValue({ data: [] })
    const result = await analyzeVersion('weblet-1', 'version-1', 24, DEFAULT_EVALUATOR_CONFIG)
    expect(result.decision).toBe('NONE')
    expect(result.sampleSize).toBe(0)
  })

  it('uses custom weight for helpfulness dimension', async () => {
    const customConfig: EvaluatorConfig = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 70 },
        correctness: { enabled: true, weight: 0 },
        hallucination: { enabled: true, weight: 0 },
      },
      optionalEvaluators: {
        toxicity: { enabled: false, weight: 0 },
        conciseness: { enabled: false, weight: 0 },
        'context-relevance': { enabled: false, weight: 0 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }

    mockFetchScores.mockResolvedValue({
      data: [
        { traceId: 'trace-1', name: 'helpfulness', value: 1 },
        { traceId: 'trace-2', name: 'helpfulness', value: 0 },
      ],
    })

    const result = await analyzeVersion('weblet-1', 'version-1', 24, customConfig)

    expect(result.dimensions).toHaveLength(1)
    expect(result.dimensions[0].name).toBe('helpfulness')
    expect(result.dimensions[0].weight).toBeCloseTo(0.70)
    expect(result.compositeScore).toBeCloseTo(0.5)
  })

  it('ignores disabled optional evaluators from custom config', async () => {
    const customConfig: EvaluatorConfig = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 70 },
        correctness: { enabled: true, weight: 0 },
        hallucination: { enabled: true, weight: 0 },
      },
      optionalEvaluators: {
        toxicity: { enabled: false, weight: 0 },
        conciseness: { enabled: false, weight: 0 },
        'context-relevance': { enabled: false, weight: 0 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }

    mockFetchScores.mockResolvedValue({
      data: [
        { traceId: 'trace-1', name: 'helpfulness', value: 1 },
        { traceId: 'trace-2', name: 'toxicity', value: 0 },
      ],
    })

    const result = await analyzeVersion('weblet-1', 'version-1', 24, customConfig)
    const names = result.dimensions.map(d => d.name)
    expect(names).not.toContain('toxicity')
    expect(names).toContain('helpfulness')
  })

  it('falls back to default config when no evaluatorConfig is passed', async () => {
    mockFetchScores.mockResolvedValue({
      data: [{ traceId: 'trace-1', name: 'helpfulness', value: 1 }],
    })

    const withDefault = await analyzeVersion('weblet-1', 'version-1', 24, DEFAULT_EVALUATOR_CONFIG)
    const withUndefined = await analyzeVersion('weblet-1', 'version-1', 24, undefined)

    expect(withDefault.compositeScore).toBeCloseTo(withUndefined.compositeScore)
    expect(withDefault.dimensions[0].weight).toBeCloseTo(withUndefined.dimensions[0].weight)
  })
})

describe('analyzeWeblet with evaluatorConfig', () => {
  beforeEach(() => {
    mockFetchScores.mockReset()
  })

  it('passes evaluatorConfig to the underlying analyze call', async () => {
    const heavyHelpfulnessConfig: EvaluatorConfig = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 70 },
        correctness: { enabled: true, weight: 0 },
        hallucination: { enabled: true, weight: 0 },
      },
      optionalEvaluators: {
        toxicity: { enabled: false, weight: 0 },
        conciseness: { enabled: false, weight: 0 },
        'context-relevance': { enabled: false, weight: 0 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }

    mockFetchScores.mockResolvedValue({
      data: [{ traceId: 'trace-1', name: 'helpfulness', value: 1 }],
    })

    const result = await analyzeWeblet('weblet-1', 24, heavyHelpfulnessConfig)
    expect(result.dimensions[0].weight).toBeCloseTo(0.70)
  })
})
