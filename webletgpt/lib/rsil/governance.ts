/**
 * RSIL Governance — checks rules before triggering optimization.
 */

import { prisma } from '@/lib/prisma'

const DEFAULT_GOVERNANCE = {
  minInteractionsBeforeOptimize: 100,
  cooldownHours: 6,
  maxUpdatesPerDay: 3,
  minTestDurationHours: 48,
  requireCreatorApproval: false,
  performanceFloor: 3.0,
}

export type GovernanceConfig = typeof DEFAULT_GOVERNANCE

export function getGovernance(raw: any): GovernanceConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_GOVERNANCE
  return { ...DEFAULT_GOVERNANCE, ...raw }
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

  return { allowed: true, reason: 'OK' }
}
