/**
 * RSIL Governance Presets
 * 
 * Pre-configured governance profiles for different risk tolerance levels.
 * - Conservative: Maximizes safety, minimizes automation risk
 * - Balanced: Recommended default for most production weblets
 * - Aggressive: Optimizes for speed, accepts higher risk
 */

import { RSILGovernance } from './governance'

export interface RSILPreset {
  /** Human-readable preset label */
  label: string
  /** Brief description of the preset's philosophy */
  description: string
  /** Complete governance configuration */
  values: RSILGovernance
}

/**
 * Conservative preset: Maximum safety, slower optimization.
 * 
 * - Requires approval for all tests
 * - Long test durations to gather strong statistical evidence
 * - High sample requirements
 * - Strict significance thresholds
 * - Canary deployments only
 * - High performance floor (quick rollback)
 * - Low concurrent test limit
 * 
 * Use for: High-stakes weblets, regulated environments, initial rollout
 */
export const CONSERVATIVE_PRESET: RSILPreset = {
  label: 'Conservative',
  description: 'Maximum safety controls — slow, deliberate optimization with strong statistical requirements',
  values: {
    enabled: false,
    optimizationFrequency: 'weekly',
    requireApproval: true,
    abTestTrafficPct: 20,
    minTestDurationHours: 72,
    minScoresPerVersion: 100,
    significanceThreshold: 0.01,
    maxTestDurationHours: 336,
    goodScoreThreshold: 0.7,
    optimizationScoreThreshold: 0.8,
    deploymentStrategy: 'canary',
    canaryStages: [5, 15, 30, 60, 100],
    monitoringWindowHours: 72,
    performanceFloor: 0.7,
    maxConcurrentTests: 1,
    cooldownHours: 48,
  },
}

/**
 * Balanced preset: Recommended default for most production weblets.
 * 
 * - Approval required by default
 * - Moderate test duration and sample size
 * - Standard statistical thresholds
 * - Canary deployment with three-stage rollout
 * - Reasonable performance floor
 * 
 * Use for: Standard production weblets, general purpose optimization
 */
export const BALANCED_PRESET: RSILPreset = {
  label: 'Balanced',
  description: 'Recommended default — balanced safety and optimization speed',
  values: {
    enabled: false,
    optimizationFrequency: 'weekly',
    requireApproval: false,
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
  },
}

/**
 * Aggressive preset: Optimize for speed, accept higher risk.
 * 
 * - Approval optional (can be bypassed)
 * - Short test durations
 * - Lower sample requirements
 * - Relaxed significance thresholds
 * - Instant deployment available
 * - Lower performance floor
 * - Multiple concurrent tests allowed
 * 
 * Use for: Development/staging, experimental weblets, high-iteration workflows
 */
export const AGGRESSIVE_PRESET: RSILPreset = {
  label: 'Aggressive',
  description: 'Fast iteration — reduced safety controls, shorter tests, quicker rollouts',
  values: {
    enabled: false,
    optimizationFrequency: 'daily',
    requireApproval: false,
    abTestTrafficPct: 70,
    minTestDurationHours: 24,
    minScoresPerVersion: 30,
    significanceThreshold: 0.10,
    maxTestDurationHours: 72,
    goodScoreThreshold: 0.5,
    optimizationScoreThreshold: 0.6,
    deploymentStrategy: 'instant',
    canaryStages: [25, 100],
    monitoringWindowHours: 24,
    performanceFloor: 0.5,
    maxConcurrentTests: 3,
    cooldownHours: 1,
  },
}

/**
 * All available presets in order: conservative, balanced, aggressive.
 * Balanced is positioned as the recommended default.
 */
export const RSIL_PRESETS: RSILPreset[] = [
  CONSERVATIVE_PRESET,
  BALANCED_PRESET,
  AGGRESSIVE_PRESET,
]

export type PresetKey = 'conservative' | 'balanced' | 'aggressive'

/**
 * Key-addressable preset mapping for deterministic lookup.
 * Use for preset selectors, settings UI, and programmatic access.
 */
export const RSIL_PRESETS_MAP: Record<PresetKey, RSILPreset> = {
  conservative: CONSERVATIVE_PRESET,
  balanced: BALANCED_PRESET,
  aggressive: AGGRESSIVE_PRESET,
}
