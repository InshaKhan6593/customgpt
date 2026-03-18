/**
 * A/B Testing Utilities for RSIL
 *
 * Statistical functions for significance testing and user bucketing.
 * - normalCDF: Standard normal cumulative distribution function
 * - calculateSignificance: Z-test for proportions
 * - hashBucket: Deterministic user bucketing
 * - startABTest: Promote draft version to TESTING status
 */

import { prisma } from '@/lib/prisma'
import { fetchScores } from '@/lib/langfuse/client'

/**
 * Standard normal cumulative distribution function (CDF)
 * Uses Abramowitz & Stegun rational approximation
 * Accurate to 7.5 decimal places
 *
 * @param z - Z-score
 * @returns Cumulative probability P(Z ≤ z)
 */
export function normalCDF(z: number): number {
  // Constants for rational approximation
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  // Save the sign of z
  const sign = z >= 0 ? 1 : -1
  z = Math.abs(z) / Math.sqrt(2)

  // Abramowitz and Stegun formula
  const t = 1 / (1 + p * z)
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z))

  return 0.5 * (1 + sign * y)
}

/**
 * Result of statistical significance test
 */
export interface SignificanceResult {
  /** Whether the difference is statistically significant at p < 0.05 */
  significant: boolean
  /** Z-score of the test */
  zScore: number
  /** P-value (two-tailed) */
  pValue: number
  /** Winner: control, variant, or neither */
  winner: 'control' | 'variant' | 'none'
  /** Confidence level (fixed at 0.95 for p=0.05) */
  confidenceLevel: number
}

export interface ABTestStatus {
  controlVersion: {
    id: string
    versionNum: number
    abTestTrafficPct: number
    abTestStartedAt: Date | null
  }
  variantVersion: {
    id: string
    versionNum: number
    abTestTrafficPct: number
    abTestStartedAt: Date | null
  }
  trafficPct: number
  startedAt: Date
  controlScores: { good: number; total: number }
  variantScores: { good: number; total: number }
  significance: SignificanceResult | null
  canConclude: boolean
  minDurationMet: boolean
  minSamplesMet: boolean
}

/**
 * Calculate statistical significance of an A/B test
 * Uses two-proportion z-test
 *
 * "Good" outcome = composite interaction score >= 0.6
 *
 * @param control - { good: number of good interactions, total: total interactions }
 * @param variant - Same structure
 * @returns Significance result with winner determination
 */
export function calculateSignificance(
  control: { good: number; total: number },
  variant: { good: number; total: number }
): SignificanceResult {
  // Handle edge cases
  if (control.total === 0 || variant.total === 0) {
    return {
      significant: false,
      zScore: 0,
      pValue: 1,
      winner: 'none',
      confidenceLevel: 0.95,
    }
  }

  // Calculate proportions
  const p1 = control.good / control.total
  const p2 = variant.good / variant.total

  // Calculate pooled proportion
  const p = (control.good + variant.good) / (control.total + variant.total)

  // Calculate standard error
  const se = Math.sqrt(p * (1 - p) * (1 / control.total + 1 / variant.total))

  // Handle zero standard error
  if (se === 0) {
    return {
      significant: false,
      zScore: 0,
      pValue: 1,
      winner: 'none',
      confidenceLevel: 0.95,
    }
  }

  // Calculate z-score
  const zScore = (p2 - p1) / se

  // Calculate p-value (two-tailed)
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)))

  // Determine significance and winner
  const significant = pValue < 0.05

  let winner: 'control' | 'variant' | 'none' = 'none'
  if (significant) {
    if (p2 > p1) {
      winner = 'variant'
    } else if (p1 > p2) {
      winner = 'control'
    }
  }

  return {
    significant,
    zScore,
    pValue,
    winner,
    confidenceLevel: 0.95,
  }
}

/**
 * Deterministic hash-based user bucketing (0-100)
 * Same userId + webletId always produces same bucket
 *
 * Uses FNV-1a hash algorithm
 *
 * @param userId - User identifier
 * @param webletId - Weblet identifier
 * @returns Bucket number 0-100
 */
export function hashBucket(userId: string, webletId: string): number {
  const input = `${userId}:${webletId}`

  // FNV-1a hash
  let hash = 2166136261 // FNV offset basis (32-bit)

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
  }

  // Convert to 0-100
  return Math.abs(hash % 101)
}

export function bucketUser(userId: string, webletId: string): number {
  return hashBucket(userId, webletId)
}

export function shouldServeVariant(userId: string, webletId: string, trafficPct: number): boolean {
  if (trafficPct <= 0) return false
  if (trafficPct >= 100) return true

  const bucket = bucketUser(userId, webletId)
  return bucket < trafficPct
}

export async function getABTestStatus(
  webletId: string,
  opts?: { minTestDurationHours?: number; minScoresPerVersion?: number }
): Promise<ABTestStatus | null> {
  const minTestDurationHours = opts?.minTestDurationHours ?? 24
  const minScoresPerVersion = opts?.minScoresPerVersion ?? 30

  const [controlVersion, variantVersion] = await Promise.all([
    prisma.webletVersion.findFirst({
      where: {
        webletId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        versionNum: true,
        abTestTrafficPct: true,
        abTestStartedAt: true,
        avgScore: true,
      },
    }),
    prisma.webletVersion.findFirst({
      where: {
        webletId,
        status: 'TESTING',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        versionNum: true,
        abTestTrafficPct: true,
        abTestStartedAt: true,
        createdAt: true,
        avgScore: true,
      },
    }),
  ])

  if (!controlVersion || !variantVersion) {
    return null
  }

  const fromTimestamp = variantVersion.abTestStartedAt?.toISOString()

  let controlScores = { total: 0, good: 0 }
  let variantScores = { total: 0, good: 0 }

  try {
    const [controlData, variantData] = await Promise.all([
      fetchScores({
        webletId,
        versionId: controlVersion.id,
        limit: 500,
        ...(fromTimestamp ? { fromTimestamp } : {}),
      }),
      fetchScores({
        webletId,
        versionId: variantVersion.id,
        limit: 500,
        ...(fromTimestamp ? { fromTimestamp } : {}),
      }),
    ])

    const computeScores = (data: Array<{ name: string; value: number }>) => {
      const total = data.length
      const good = data.filter((s) => s.value >= (s.name === 'user-rating' ? 3 : 0.5)).length
      return { total, good }
    }

    controlScores = computeScores(controlData.data)
    variantScores = computeScores(variantData.data)
  } catch (error) {
    console.warn('[rsil] Failed to fetch Langfuse scores for A/B test:', error)
  }

  const significance =
    controlScores.total > 0 && variantScores.total > 0
      ? calculateSignificance(controlScores, variantScores)
      : null

  const startedAt = variantVersion.abTestStartedAt ?? variantVersion.createdAt
  const minDurationMs = minTestDurationHours * 60 * 60 * 1000
  const minDurationMet = Date.now() - startedAt.getTime() >= minDurationMs
  const minSamplesMet =
    controlScores.total >= minScoresPerVersion && variantScores.total >= minScoresPerVersion
  const canConclude = minDurationMet && minSamplesMet && significance?.significant === true

  return {
    controlVersion: {
      id: controlVersion.id,
      versionNum: controlVersion.versionNum,
      abTestTrafficPct: controlVersion.abTestTrafficPct,
      abTestStartedAt: controlVersion.abTestStartedAt,
    },
    variantVersion: {
      id: variantVersion.id,
      versionNum: variantVersion.versionNum,
      abTestTrafficPct: variantVersion.abTestTrafficPct,
      abTestStartedAt: variantVersion.abTestStartedAt,
    },
    trafficPct: variantVersion.abTestTrafficPct,
    startedAt,
    controlScores,
    variantScores,
    significance,
    canConclude,
    minDurationMet,
    minSamplesMet,
  }
}

/**
 * Start an A/B test by promoting a DRAFT version to TESTING status
 *
 * @param params - { webletId, draftVersionId, trafficPct, userId }
 * @throws If version not found, already in A/B test, or DB error
 */
export async function startABTest({
  webletId,
  draftVersionId,
  trafficPct,
  userId,
}: {
  webletId: string
  draftVersionId: string
  trafficPct: number
  userId: string
}): Promise<void> {
  try {
    // Fetch the draft version
    const draftVersion = await prisma.webletVersion.findUnique({
      where: { id: draftVersionId },
    })

    if (!draftVersion) {
      throw new Error(`Draft version ${draftVersionId} not found`)
    }

    if (draftVersion.webletId !== webletId) {
      throw new Error(`Version ${draftVersionId} does not belong to weblet ${webletId}`)
    }

    if (draftVersion.status !== 'DRAFT') {
      throw new Error(`Version ${draftVersionId} is not in DRAFT status (current: ${draftVersion.status})`)
    }

    // Check for existing active A/B test
    const activeABTest = await prisma.webletVersion.findFirst({
      where: {
        webletId,
        status: 'TESTING',
        isAbTest: true,
      },
    })

    if (activeABTest) {
      throw new Error(`Weblet ${webletId} already has an active A/B test running`)
    }

    // Promote to TESTING
    await prisma.webletVersion.update({
      where: { id: draftVersionId },
      data: {
        status: 'TESTING',
        isAbTest: true,
        abTestTrafficPct: trafficPct,
        abTestStartedAt: new Date(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to start A/B test: ${message}`)
  }
}
