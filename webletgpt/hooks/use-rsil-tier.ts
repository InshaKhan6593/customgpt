/**
 * Achievement Tier Calculation Hook
 * 
 * Determines RSIL achievement tier (Bronze → Silver → Gold → Platinum)
 * based on score history from metrics.timeSeries.
 * 
 * IMPORTANT: API limits score history to 30 days max.
 * Thresholds adjusted accordingly (7/14/28 days, NOT 14/28/56).
 */

import { PerformanceTrendPoint } from '../components/rsil/types'

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface TierResult {
  /** Current achievement tier */
  tier: AchievementTier
  /** Progress toward next tier (0-1) */
  progress: number
  /** Name of next tier, or null if already at platinum */
  nextTier: AchievementTier | null
  /** Number of consecutive days at current performance level */
  daysAtCurrentLevel: number
}

interface TierConfig {
  threshold: number
  minConsecutiveDays: number
  requireZeroRollbacks?: boolean
}

const TIER_CONFIGS: Record<Exclude<AchievementTier, 'bronze'>, TierConfig> = {
  silver: {
    threshold: 0.7,
    minConsecutiveDays: 7,
  },
  gold: {
    threshold: 0.85,
    minConsecutiveDays: 14,
  },
  platinum: {
    threshold: 0.9,
    minConsecutiveDays: 28,
    requireZeroRollbacks: true,
  },
}

/**
 * Calculate achievement tier from score history.
 * 
 * Tier logic (adjusted for 30-day API limit):
 * - Bronze: Any score history exists (RSIL enabled)
 * - Silver: compositeScore ≥ 0.7 for 7+ consecutive days
 * - Gold: compositeScore ≥ 0.85 for 14+ consecutive days
 * - Platinum: compositeScore ≥ 0.9 for 28+ consecutive days, zero rollbacks
 * 
 * @param scoreHistory - Array of PerformanceTrendPoint from metrics.timeSeries
 * @param rollbackCount - Number of rollbacks in period (for Platinum requirement)
 * @returns TierResult with tier, progress, next tier, and streak info
 */
export function calculateRsilTier(
  scoreHistory: PerformanceTrendPoint[],
  rollbackCount: number = 0
): TierResult {
  // Empty history = no tier (not even bronze)
  if (!scoreHistory || scoreHistory.length === 0) {
    return {
      tier: 'bronze',
      progress: 0,
      nextTier: 'silver',
      daysAtCurrentLevel: 0,
    }
  }

  // Sort by date ascending (oldest first) to calculate streaks
  const sortedHistory = [...scoreHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )

  // Calculate highest tier achieved
  const achievedTier = determineAchievedTier(sortedHistory, rollbackCount)
  
  // Calculate progress toward next tier
  const { progress, daysAtCurrentLevel } = calculateProgress(
    sortedHistory,
    achievedTier,
    rollbackCount
  )

  const nextTier = getNextTier(achievedTier)

  return {
    tier: achievedTier,
    progress,
    nextTier,
    daysAtCurrentLevel,
  }
}

/**
 * Determine the highest tier achieved based on score history.
 */
function determineAchievedTier(
  sortedHistory: PerformanceTrendPoint[],
  rollbackCount: number
): AchievementTier {
  // Check from highest to lowest tier
  if (meetsRequirement(sortedHistory, 'platinum', rollbackCount)) {
    return 'platinum'
  }
  if (meetsRequirement(sortedHistory, 'gold', rollbackCount)) {
    return 'gold'
  }
  if (meetsRequirement(sortedHistory, 'silver', rollbackCount)) {
    return 'silver'
  }
  
  // Default: Bronze (any history exists)
  return 'bronze'
}

/**
 * Check if score history meets requirements for a specific tier.
 */
function meetsRequirement(
  sortedHistory: PerformanceTrendPoint[],
  tier: Exclude<AchievementTier, 'bronze'>,
  rollbackCount: number
): boolean {
  const config = TIER_CONFIGS[tier]
  
  // Platinum requires zero rollbacks
  if (config.requireZeroRollbacks && rollbackCount > 0) {
    return false
  }

  // Find longest consecutive streak meeting threshold
  const longestStreak = findLongestConsecutiveStreak(
    sortedHistory,
    config.threshold
  )

  return longestStreak >= config.minConsecutiveDays
}

/**
 * Find the longest consecutive streak where score >= threshold.
 * Returns number of consecutive days.
 */
function findLongestConsecutiveStreak(
  sortedHistory: PerformanceTrendPoint[],
  threshold: number
): number {
  let currentStreak = 0
  let longestStreak = 0

  for (const point of sortedHistory) {
    const score = typeof point.composite === 'number' ? point.composite : 0

    if (score >= threshold) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  return longestStreak
}

/**
 * Calculate progress toward next tier and current streak.
 */
function calculateProgress(
  sortedHistory: PerformanceTrendPoint[],
  currentTier: AchievementTier,
  rollbackCount: number
): { progress: number; daysAtCurrentLevel: number } {
  // Already at max tier
  if (currentTier === 'platinum') {
    return { progress: 1, daysAtCurrentLevel: sortedHistory.length }
  }

  const nextTier = getNextTier(currentTier)
  if (!nextTier || nextTier === 'bronze') {
    return { progress: 1, daysAtCurrentLevel: sortedHistory.length }
  }

  const config = TIER_CONFIGS[nextTier]
  
  // Current consecutive streak toward next tier
  const currentStreak = findCurrentConsecutiveStreak(
    sortedHistory,
    config.threshold
  )

  // Progress = current streak / required days (capped at 1.0)
  const progress = Math.min(currentStreak / config.minConsecutiveDays, 1)

  return {
    progress,
    daysAtCurrentLevel: currentStreak,
  }
}

/**
 * Find the current consecutive streak (from most recent backward).
 */
function findCurrentConsecutiveStreak(
  sortedHistory: PerformanceTrendPoint[],
  threshold: number
): number {
  let streak = 0

  // Iterate backward from most recent
  for (let i = sortedHistory.length - 1; i >= 0; i--) {
    const point = sortedHistory[i]
    const score = typeof point.composite === 'number' ? point.composite : 0

    if (score >= threshold) {
      streak++
    } else {
      break // Streak broken
    }
  }

  return streak
}

/**
 * Get the next tier above the current one.
 */
function getNextTier(current: AchievementTier): AchievementTier | null {
  const tierOrder: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum']
  const currentIndex = tierOrder.indexOf(current)
  
  if (currentIndex === -1 || currentIndex === tierOrder.length - 1) {
    return null
  }
  
  return tierOrder[currentIndex + 1]
}
