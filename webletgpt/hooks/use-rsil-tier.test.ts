/**
 * Quick sanity check for tier calculation logic.
 * Tests basic tier thresholds with minimal datasets.
 */

import { calculateRsilTier, AchievementTier } from './use-rsil-tier.js'
import { PerformanceTrendPoint } from '../components/rsil/types.js'

function generateHistory(days: number, score: number): PerformanceTrendPoint[] {
  const history: PerformanceTrendPoint[] = []
  const now = new Date()
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - (days - i - 1))
    history.push({
      date: date.toISOString().split('T')[0],
      composite: score,
    })
  }
  
  return history
}

function assertTier(
  actual: AchievementTier,
  expected: AchievementTier,
  scenario: string
) {
  if (actual !== expected) {
    throw new Error(
      `❌ ${scenario}: Expected tier '${expected}', got '${actual}'`
    )
  }
  console.log(`✅ ${scenario}: tier=${actual}`)
}

// Test 1: Bronze tier for new user
const bronzeHistory = generateHistory(3, 0.5)
const bronze = calculateRsilTier(bronzeHistory, 0)
assertTier(bronze.tier, 'bronze', 'New user with low scores')

// Test 2: Silver tier (7 days at 0.7)
const silverHistory = generateHistory(7, 0.75)
const silver = calculateRsilTier(silverHistory, 0)
assertTier(silver.tier, 'silver', '7 consecutive days at 0.75')

// Test 3: Gold tier (14 days at 0.85)
const goldHistory = generateHistory(14, 0.87)
const gold = calculateRsilTier(goldHistory, 0)
assertTier(gold.tier, 'gold', '14 consecutive days at 0.87')

// Test 4: Platinum tier (28 days at 0.9, zero rollbacks)
const platinumHistory = generateHistory(28, 0.92)
const platinum = calculateRsilTier(platinumHistory, 0)
assertTier(platinum.tier, 'platinum', '28 consecutive days at 0.92, no rollbacks')

// Test 5: Platinum blocked by rollbacks
const platinumWithRollbacks = calculateRsilTier(platinumHistory, 1)
assertTier(
  platinumWithRollbacks.tier,
  'gold',
  '28 days at 0.92 BUT 1 rollback (max Gold)'
)

// Test 6: Progress toward next tier
const partialSilver = generateHistory(4, 0.72)
const progress = calculateRsilTier(partialSilver, 0)
assertTier(progress.tier, 'bronze', '4 days at 0.72 (progress toward Silver)')
if (progress.nextTier !== 'silver') {
  throw new Error(`Expected nextTier='silver', got '${progress.nextTier}'`)
}
if (progress.daysAtCurrentLevel !== 4) {
  throw new Error(
    `Expected daysAtCurrentLevel=4, got ${progress.daysAtCurrentLevel}`
  )
}
console.log(
  `✅ Progress calculation: ${progress.daysAtCurrentLevel}/7 days toward Silver (${Math.round(progress.progress * 100)}%)`
)

// Test 7: Empty history
const empty = calculateRsilTier([], 0)
assertTier(empty.tier, 'bronze', 'Empty history defaults to Bronze')

console.log('\n✅ All tier calculation tests passed')
