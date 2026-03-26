import { describe, expect, it } from 'bun:test'
import {
  DEFAULT_EVALUATOR_CONFIG,
  EvaluatorConfigSchema,
  normalizeOptionalWeights,
  type EvaluatorConfig,
} from './governance'

describe('EvaluatorConfigSchema', () => {
  it('accepts a fully valid evaluatorConfig', () => {
    const input: EvaluatorConfig = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 20 },
        correctness: { enabled: true, weight: 15 },
        hallucination: { enabled: true, weight: 10 },
      },
      optionalEvaluators: {
        toxicity: { enabled: true, weight: 5 },
        conciseness: { enabled: true, weight: 5 },
        'context-relevance': { enabled: true, weight: 15 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }
    const result = EvaluatorConfigSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('rejects enabled: false for a base evaluator (helpfulness)', () => {
    const input = {
      baseEvaluators: {
        helpfulness: { enabled: false, weight: 20 },
        correctness: { enabled: true, weight: 15 },
        hallucination: { enabled: true, weight: 10 },
      },
      optionalEvaluators: {
        toxicity: { enabled: true, weight: 5 },
        conciseness: { enabled: true, weight: 5 },
        'context-relevance': { enabled: true, weight: 15 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }
    const result = EvaluatorConfigSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('rejects enabled: false for correctness (base evaluator)', () => {
    const input = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 20 },
        correctness: { enabled: false, weight: 15 },
        hallucination: { enabled: true, weight: 10 },
      },
      optionalEvaluators: {
        toxicity: { enabled: true, weight: 5 },
        conciseness: { enabled: true, weight: 5 },
        'context-relevance': { enabled: true, weight: 15 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }
    const result = EvaluatorConfigSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('fills defaults when given an empty object', () => {
    const result = EvaluatorConfigSchema.safeParse({
      baseEvaluators: {},
      optionalEvaluators: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.baseEvaluators.helpfulness).toEqual({ enabled: true, weight: 20 })
      expect(result.data.baseEvaluators.correctness).toEqual({ enabled: true, weight: 15 })
      expect(result.data.baseEvaluators.hallucination).toEqual({ enabled: true, weight: 10 })
      expect(result.data.optionalEvaluators.toxicity).toEqual({ enabled: true, weight: 5 })
      expect(result.data.optionalEvaluators['context-relevance']).toEqual({ enabled: true, weight: 15 })
      expect(result.data.optionalEvaluators.faithfulness).toEqual({ enabled: false, weight: 0 })
    }
  })

  it('rejects weight > 100 for an optional evaluator', () => {
    const input = {
      baseEvaluators: {
        helpfulness: { enabled: true, weight: 20 },
        correctness: { enabled: true, weight: 15 },
        hallucination: { enabled: true, weight: 10 },
      },
      optionalEvaluators: {
        toxicity: { enabled: true, weight: 200 },
        conciseness: { enabled: true, weight: 5 },
        'context-relevance': { enabled: true, weight: 15 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }
    const result = EvaluatorConfigSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('normalizeOptionalWeights', () => {
  it('preserves default optional weights without redistributing them', () => {
    const normalized = normalizeOptionalWeights(DEFAULT_EVALUATOR_CONFIG)
    expect(normalized.optionalEvaluators.toxicity.weight).toBe(5)
    expect(normalized.optionalEvaluators.conciseness.weight).toBe(5)
    expect(normalized.optionalEvaluators['context-relevance'].weight).toBe(15)
  })

  it('enabling a new optional evaluator does not change other enabled weights', () => {
    const config: EvaluatorConfig = {
      ...DEFAULT_EVALUATOR_CONFIG,
      optionalEvaluators: {
        ...DEFAULT_EVALUATOR_CONFIG.optionalEvaluators,
        faithfulness: { enabled: true, weight: 10 },
      },
    }
    const normalized = normalizeOptionalWeights(config)
    expect(normalized.optionalEvaluators.toxicity.weight).toBe(5)
    expect(normalized.optionalEvaluators.conciseness.weight).toBe(5)
    expect(normalized.optionalEvaluators['context-relevance'].weight).toBe(15)
    expect(normalized.optionalEvaluators.faithfulness.enabled).toBe(true)
    expect(normalized.optionalEvaluators.faithfulness.weight).toBe(10)
  })

  it('disabled evaluators receive weight 0 after normalization', () => {
    const normalized = normalizeOptionalWeights(DEFAULT_EVALUATOR_CONFIG)
    expect(normalized.optionalEvaluators['context-correctness'].weight).toBe(0)
    expect(normalized.optionalEvaluators.faithfulness.weight).toBe(0)
    expect(normalized.optionalEvaluators['answer-relevance'].weight).toBe(0)
  })

  it('all-disabled optional config yields zero total optional weight', () => {
    const allDisabled: EvaluatorConfig = {
      ...DEFAULT_EVALUATOR_CONFIG,
      optionalEvaluators: {
        toxicity: { enabled: false, weight: 0 },
        conciseness: { enabled: false, weight: 0 },
        'context-relevance': { enabled: false, weight: 0 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }
    const normalized = normalizeOptionalWeights(allDisabled)
    const total = Object.values(normalized.optionalEvaluators).reduce((sum, e) => sum + e.weight, 0)
    expect(total).toBe(0)
  })

  it('does not mutate the input config', () => {
    const original = structuredClone(DEFAULT_EVALUATOR_CONFIG)
    normalizeOptionalWeights(DEFAULT_EVALUATOR_CONFIG)
    expect(DEFAULT_EVALUATOR_CONFIG).toEqual(original)
  })

  it('single enabled optional evaluator keeps its configured weight', () => {
    const config: EvaluatorConfig = {
      ...DEFAULT_EVALUATOR_CONFIG,
      optionalEvaluators: {
        toxicity: { enabled: false, weight: 0 },
        conciseness: { enabled: false, weight: 0 },
        'context-relevance': { enabled: true, weight: 15 },
        'context-correctness': { enabled: false, weight: 0 },
        faithfulness: { enabled: false, weight: 0 },
        'answer-relevance': { enabled: false, weight: 0 },
      },
    }
    const normalized = normalizeOptionalWeights(config)
    expect(normalized.optionalEvaluators['context-relevance'].weight).toBe(15)
  })

  it('clamps enabled optional evaluator weights to the 25% per-evaluator max', () => {
    const config: EvaluatorConfig = {
      ...DEFAULT_EVALUATOR_CONFIG,
      optionalEvaluators: {
        ...DEFAULT_EVALUATOR_CONFIG.optionalEvaluators,
        toxicity: { enabled: true, weight: 40 },
      },
    }

    const normalized = normalizeOptionalWeights(config)

    expect(normalized.optionalEvaluators.toxicity.weight).toBe(25)
  })
})

describe('DEFAULT_EVALUATOR_CONFIG', () => {
  it('base evaluator weights sum to 45', () => {
    const { helpfulness, correctness, hallucination } = DEFAULT_EVALUATOR_CONFIG.baseEvaluators
    expect(helpfulness.weight + correctness.weight + hallucination.weight).toBe(45)
  })

  it('all base evaluators have enabled: true', () => {
    for (const entry of Object.values(DEFAULT_EVALUATOR_CONFIG.baseEvaluators)) {
      expect(entry.enabled).toBe(true)
    }
  })
})
