/**
 * RSIL Governance — Type system, Zod schema, and defaults for RSIL configuration.
 *
 * Governs A/B test parameters, approval requirements, deployment strategies,
 * and safety thresholds for automated prompt optimization.
 */

import { z } from 'zod'

interface BaseEvaluatorEntry {
  enabled: true
  weight: number
}

interface OptionalEvaluatorEntry {
  enabled: boolean
  weight: number
}

/**
 * Configurable evaluator weights for RSIL scoring.
 *
 * - Base evaluators are always enabled (cannot be disabled).
 * - Optional evaluators can be toggled; use normalizeOptionalWeights() after changes.
 * - Weights are expressed as percentages (0-100). User-rating (30%) is NOT in this config.
 */
export interface EvaluatorConfig {
  baseEvaluators: {
    helpfulness: BaseEvaluatorEntry
    correctness: BaseEvaluatorEntry
    hallucination: BaseEvaluatorEntry
  }
  optionalEvaluators: {
    toxicity: OptionalEvaluatorEntry
    conciseness: OptionalEvaluatorEntry
    'context-relevance': OptionalEvaluatorEntry
    'context-correctness': OptionalEvaluatorEntry
    faithfulness: OptionalEvaluatorEntry
    'answer-relevance': OptionalEvaluatorEntry
  }
}

const BaseEvaluatorEntrySchema = z.object({
  enabled: z.literal(true),
  weight: z.number().min(0).max(100),
})

const OptionalEvaluatorEntrySchema = z.object({
  enabled: z.boolean(),
  weight: z.number().min(0).max(100),
})

export const EvaluatorConfigSchema = z.object({
  baseEvaluators: z.object({
    helpfulness: BaseEvaluatorEntrySchema.default({ enabled: true, weight: 20 }),
    correctness: BaseEvaluatorEntrySchema.default({ enabled: true, weight: 15 }),
    hallucination: BaseEvaluatorEntrySchema.default({ enabled: true, weight: 10 }),
  }),
  optionalEvaluators: z.object({
    toxicity: OptionalEvaluatorEntrySchema.default({ enabled: true, weight: 5 }),
    conciseness: OptionalEvaluatorEntrySchema.default({ enabled: true, weight: 5 }),
    'context-relevance': OptionalEvaluatorEntrySchema.default({ enabled: true, weight: 15 }),
    'context-correctness': OptionalEvaluatorEntrySchema.default({ enabled: false, weight: 0 }),
    faithfulness: OptionalEvaluatorEntrySchema.default({ enabled: false, weight: 0 }),
    'answer-relevance': OptionalEvaluatorEntrySchema.default({ enabled: false, weight: 0 }),
  }),
})

export const DEFAULT_EVALUATOR_CONFIG: EvaluatorConfig = {
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

export const OPTIONAL_EVALUATOR_MAX_WEIGHT = 25

export function normalizeOptionalWeights(config: EvaluatorConfig): EvaluatorConfig {
  const entries = Object.entries(config.optionalEvaluators) as [
    keyof EvaluatorConfig['optionalEvaluators'],
    OptionalEvaluatorEntry,
  ][]

  const normalizedOptional = { ...config.optionalEvaluators }

  for (const [key, value] of entries) {
    if (!value.enabled) {
      normalizedOptional[key] = { ...config.optionalEvaluators[key], weight: 0 }
      continue
    }

    normalizedOptional[key] = {
      ...config.optionalEvaluators[key],
      weight: Math.min(Math.max(value.weight, 0), OPTIONAL_EVALUATOR_MAX_WEIGHT),
    }
  }

  return {
    ...config,
    optionalEvaluators: normalizedOptional,
  }
}

export interface RSILGovernance {
  /** Enable or disable RSIL automation for this weblet */
  enabled: boolean

  /** How frequently to run optimization: daily, weekly, or manual trigger */
  optimizationFrequency: 'daily' | 'weekly' | 'manual'

  /** Require user approval before A/B test starts (recommended: true) */
  requireApproval: boolean

  /** Percentage of traffic sent to candidate version during A/B test (1-99) */
  abTestTrafficPct: number

  /** Minimum hours before a test can conclude (prevents premature decisions) */
  minTestDurationHours: number

  /** Minimum score samples per version required before comparison (e.g., 50 conversations) */
  minScoresPerVersion: number

  /** Statistical significance threshold (p-value) for declaring winner; 0.05 = 95% confidence */
  significanceThreshold: number

  maxTestDurationHours: number

  goodScoreThreshold: number

  optimizationScoreThreshold: number

  /** Deployment strategy: instant rollout or canary with staged traffic increases */
  deploymentStrategy: 'instant' | 'canary'

  /** Traffic percentages for canary stages (e.g., [10, 50, 100]) */
  canaryStages: number[]

  /** Hours to monitor after promotion before declaring success (auto-rollback window) */
  monitoringWindowHours: number

  /** Auto-rollback if performance drops below this floor (0-1 normalized score) */
  performanceFloor: number

  /** Maximum concurrent A/B tests to run simultaneously (prevents resource exhaustion) */
  maxConcurrentTests: number

  /** Hours to wait between optimization runs (prevents test churn) */
  cooldownHours: number

  evaluatorConfig?: EvaluatorConfig
}

/**
 * Zod schema for RSILGovernance.
 * Validates ranges, types, and inter-field constraints.
 */
export const RSILGovernanceSchema = z.object({
  enabled: z.boolean().default(false),
  optimizationFrequency: z
    .enum(['daily', 'weekly', 'manual'])
    .default('weekly'),
  requireApproval: z.boolean().default(true),
  abTestTrafficPct: z
    .number()
    .int()
    .min(1)
    .max(99)
    .default(50),
  minTestDurationHours: z
    .number()
    .int()
    .min(1)
    .default(48),
  minScoresPerVersion: z
    .number()
    .int()
    .min(1)
    .default(50),
  significanceThreshold: z
    .number()
    .min(0.01)
    .max(0.5)
    .default(0.05),
  maxTestDurationHours: z
    .number()
    .int()
    .min(1)
    .default(168),
  goodScoreThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.6),
  optimizationScoreThreshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.7),
  deploymentStrategy: z
    .enum(['instant', 'canary'])
    .default('canary'),
  canaryStages: z
    .array(z.number().int().min(1).max(100))
    .default([10, 50, 100]),
  monitoringWindowHours: z
    .number()
    .int()
    .min(1)
    .default(48),
  performanceFloor: z
    .number()
    .min(0)
    .max(1)
    .default(0.6),
  maxConcurrentTests: z
    .number()
    .int()
    .min(1)
    .default(1),
  cooldownHours: z
    .number()
    .int()
    .min(0)
    .default(6),
})

/**
 * Default RSIL governance configuration.
 * Enables conservative A/B testing with user approval required.
 * Suitable for production weblets that prioritize safety over speed.
 */
export const DEFAULT_GOVERNANCE: RSILGovernance = {
  enabled: false,
  optimizationFrequency: 'weekly',
  requireApproval: true,
  abTestTrafficPct: 50,
  minTestDurationHours: 48,
  minScoresPerVersion: 50,
  significanceThreshold: 0.05,
  maxTestDurationHours: 168,
  goodScoreThreshold: 0.6,
  optimizationScoreThreshold: 0.7,
  deploymentStrategy: 'canary',
  canaryStages: [10, 50, 100],
  monitoringWindowHours: 48,
  performanceFloor: 0.6,
  maxConcurrentTests: 1,
  cooldownHours: 6,
}

/**
 * Parse and validate a governance object from a Weblet's rsilGovernance JSON field.
 * If the field is null/undefined/invalid, returns DEFAULT_GOVERNANCE.
 * Otherwise merges parsed partial config with defaults.
 *
 * @param weblet - Object with rsilGovernance field (typically a Weblet from DB)
 * @returns Typed and merged RSILGovernance object
 */
export function getGovernance(weblet: {
  rsilGovernance: unknown
}): RSILGovernance {
  if (!weblet.rsilGovernance) {
    return DEFAULT_GOVERNANCE
  }

  const result = validateGovernance(weblet.rsilGovernance)
  if (!result.success) {
    return DEFAULT_GOVERNANCE
  }

  return {
    ...DEFAULT_GOVERNANCE,
    ...result.data,
  }
}

/**
 * Validate governance input against the Zod schema.
 * Uses partial() to allow partial updates (not all fields required).
 *
 * @param input - Unknown input (typically from JSON parsing)
 * @returns Zod SafeParseResult with typed data or validation errors
 */
export function validateGovernance(input: unknown) {
  return RSILGovernanceSchema.partial().safeParse(input)
}
