/**
 * RSIL Governance — checks rules before triggering optimization.
 */

import { prisma } from '@/lib/prisma'

export const AUTO_OPTIMIZATION_FREQUENCIES = ['every_6h', 'every_12h', 'daily', 'weekly'] as const
export type AutoOptimizationFrequency = (typeof AUTO_OPTIMIZATION_FREQUENCIES)[number]

const DEFAULT_GOVERNANCE = {
  minInteractionsBeforeOptimize: 100,
  cooldownHours: 6,
  maxUpdatesPerDay: 3,
  minTestDurationHours: 48,
  requireCreatorApproval: false,
  performanceFloor: 3.0,
  autoOptimizationEnabled: false,
  autoOptimizationFrequency: 'daily' as AutoOptimizationFrequency,
  autoOptimizationHour: 0,
}

export type GovernanceConfig = typeof DEFAULT_GOVERNANCE

export function getGovernance(raw: any): GovernanceConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_GOVERNANCE
  return { ...DEFAULT_GOVERNANCE, ...raw }
}

export function shouldRunAutoOptimization(governance: GovernanceConfig): boolean {
  if (!governance.autoOptimizationEnabled) return false

  const now = new Date()
  const currentHour = now.getUTCHours()
  const targetHour = governance.autoOptimizationHour

  switch (governance.autoOptimizationFrequency) {
    case 'every_6h':
      return currentHour % 6 === targetHour % 6
    case 'every_12h':
      return currentHour % 12 === targetHour % 12
    case 'daily':
      return currentHour === targetHour
    case 'weekly':
      return now.getUTCDay() === 1 && currentHour === targetHour
    default:
      return false
  }
}

export async function checkGovernance(webletId: string): Promise<{ allowed: boolean; reason: string }> {
  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    select: { rsilEnabled: true, rsilGovernance: true },
  })

  if (!weblet?.rsilEnabled) {
    return { allowed: false, reason: 'RSIL not enabled for this weblet' }
  }

  const governance = getGovernance(weblet.rsilGovernance)

  // Check if there's already an active A/B test
  const activeTest = await prisma.webletVersion.findFirst({
    where: { webletId, status: 'TESTING', isAbTest: true },
  })

  if (activeTest) {
    return { allowed: false, reason: 'A/B test already running' }
  }

  // Check cooldown (time since last optimization)
  const recentOptimization = await prisma.webletVersion.findFirst({
    where: {
      webletId,
      isAbTest: true,
      abTestEndedAt: { not: null },
    },
    orderBy: { abTestEndedAt: 'desc' },
  })

  if (recentOptimization?.abTestEndedAt) {
    const hoursSince = (Date.now() - recentOptimization.abTestEndedAt.getTime()) / (1000 * 60 * 60)
    if (hoursSince < governance.cooldownHours) {
      return { allowed: false, reason: `Cooldown active (${governance.cooldownHours}h required)` }
    }
  }

  // Check max updates per day
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const updatesToday = await prisma.webletVersion.count({
    where: {
      webletId,
      isAbTest: true,
      createdAt: { gte: today },
    },
  })

  if (updatesToday >= governance.maxUpdatesPerDay) {
    return { allowed: false, reason: `Max ${governance.maxUpdatesPerDay} updates per day reached` }
  }

  const interactionCount = await prisma.chatMessage.count({
    where: { chatSession: { webletId } },
  })

  if (interactionCount < governance.minInteractionsBeforeOptimize) {
    return { allowed: false, reason: `Not enough interactions yet (${interactionCount}/${governance.minInteractionsBeforeOptimize})` }
  }

  return { allowed: true, reason: 'OK' }
}
