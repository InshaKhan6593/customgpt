import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { analyzeVersion } from '@/lib/rsil/analyzer'
import { rollbackVersion, checkPerformanceFloor, startABTest } from '@/lib/rsil/deployer'
import { generateImprovedPrompt } from '@/lib/rsil/generator'
import { getGovernance } from '@/lib/rsil/governance'

const OPTIMIZATION_THRESHOLD = 0.7
const HOURS_IN_MS = 60 * 60 * 1000

function getFrequencyHours(frequency: 'daily' | 'weekly' | 'manual'): number | null {
  if (frequency === 'manual') {
    return null
  }

  return frequency === 'daily' ? 24 : 24 * 7
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function getHoursAgo(timestamp: Date | string, now: Date): number {
  return (now.getTime() - toDate(timestamp).getTime()) / HOURS_IN_MS
}

export const rsilOptimizationCron = inngest.createFunction(
  { id: 'rsil-optimization-cron' },
  { cron: '0 2 * * *' },
  async ({ step }) => {
    const now = new Date()

    const weblets = await step.run('load-rsil-enabled-weblets', async () => {
      return prisma.weblet.findMany({
        where: { rsilEnabled: true },
        select: {
          id: true,
          name: true,
          rsilGovernance: true,
        },
      })
    })

    let optimizedCount = 0
    let skippedCount = 0

    for (const weblet of weblets) {
      const governance = getGovernance({ rsilGovernance: weblet.rsilGovernance })

      if (!governance.enabled) {
        skippedCount += 1
        console.log(`[RSIL][Optimize] Skip ${weblet.id}: governance.disabled`)
        continue
      }

      const frequencyHours = getFrequencyHours(governance.optimizationFrequency)
      if (frequencyHours === null) {
        skippedCount += 1
        console.log(`[RSIL][Optimize] Skip ${weblet.id}: optimizationFrequency=manual`)
        continue
      }

      const latestVersion = await step.run(`load-latest-version-${weblet.id}`, async () => {
        return prisma.webletVersion.findFirst({
          where: { webletId: weblet.id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            createdAt: true,
            versionNum: true,
          },
        })
      })

      if (latestVersion) {
        const sinceLastVersionHours = getHoursAgo(latestVersion.createdAt, now)
        if (sinceLastVersionHours < frequencyHours) {
          skippedCount += 1
          console.log(
            `[RSIL][Optimize] Skip ${weblet.id}: frequency gate (${governance.optimizationFrequency}) not met`
          )
          continue
        }
      }

      const activeTest = await step.run(`load-testing-version-${weblet.id}`, async () => {
        return prisma.webletVersion.findFirst({
          where: {
            webletId: weblet.id,
            status: 'TESTING',
          },
          select: {
            id: true,
            versionNum: true,
          },
        })
      })

      if (activeTest) {
        skippedCount += 1
        console.log(`[RSIL][Optimize] Skip ${weblet.id}: TESTING version exists (${activeTest.id})`)
        continue
      }

      const activeVersion = await step.run(`load-active-version-${weblet.id}`, async () => {
        return prisma.webletVersion.findFirst({
          where: {
            webletId: weblet.id,
            status: 'ACTIVE',
          },
          orderBy: { versionNum: 'desc' },
          select: {
            id: true,
            prompt: true,
            model: true,
            versionNum: true,
            createdAt: true,
            abTestEndedAt: true,
          },
        })
      })

      if (!activeVersion) {
        skippedCount += 1
        console.log(`[RSIL][Optimize] Skip ${weblet.id}: no ACTIVE version`)
        continue
      }

      const promotedAt = activeVersion.abTestEndedAt ?? activeVersion.createdAt
      const hoursSincePromotion = getHoursAgo(promotedAt, now)
      if (hoursSincePromotion < governance.cooldownHours) {
        skippedCount += 1
        console.log(
          `[RSIL][Optimize] Skip ${weblet.id}: cooldown ${governance.cooldownHours}h (elapsed ${hoursSincePromotion.toFixed(1)}h)`
        )
        continue
      }

      const analysis = await step.run(`analyze-active-version-${weblet.id}`, async () => {
        return analyzeVersion(weblet.id, activeVersion.id, 24)
      })

      if (analysis.compositeScore >= OPTIMIZATION_THRESHOLD) {
        skippedCount += 1
        console.log(
          `[RSIL][Optimize] Skip ${weblet.id}: composite score ${analysis.compositeScore.toFixed(3)} >= ${OPTIMIZATION_THRESHOLD}`
        )
        continue
      }

      const generation = await step.run(`generate-improved-prompt-${weblet.id}`, async () => {
        return generateImprovedPrompt({
          webletId: weblet.id,
          currentPrompt: activeVersion.prompt,
          weakDimensions: analysis.weakDimensions,
          compositeScore: analysis.compositeScore,
          dimensions: analysis.dimensions,
        })
      })

      const maxVersion = await step.run(`load-max-version-num-${weblet.id}`, async () => {
        return prisma.webletVersion.findFirst({
          where: { webletId: weblet.id },
          orderBy: { versionNum: 'desc' },
          select: { versionNum: true },
        })
      })

      const draftVersion = await step.run(`create-rsil-draft-${weblet.id}`, async () => {
        return prisma.webletVersion.create({
          data: {
            webletId: weblet.id,
            prompt: generation.improvedPrompt,
            status: 'DRAFT',
            model: activeVersion.model,
            versionNum: (maxVersion?.versionNum ?? 0) + 1,
            commitMsg: [
              `RSIL optimization from v${activeVersion.versionNum}.`,
              `score=${analysis.compositeScore.toFixed(3)} weak=[${analysis.weakDimensions.join(', ') || 'none'}].`,
              `strategy=${governance.deploymentStrategy} canaryStages=[${governance.canaryStages.join(',')}].`,
              `approvalRequired=${governance.requireApproval}.`,
              generation.changelog,
            ].join(' '),
          },
        })
      })

      console.log(
        `[RSIL][Optimize] Draft created for ${weblet.id}: ${draftVersion.id} ` +
          `(approval=${governance.requireApproval}, traffic=${governance.abTestTrafficPct}%, strategy=${governance.deploymentStrategy})`
      )

      if (!governance.requireApproval) {
        await step.run(`start-ab-test-${weblet.id}`, async () => {
          return startABTest({
            webletId: weblet.id,
            draftVersionId: draftVersion.id,
            trafficPct: governance.abTestTrafficPct,
          })
        })

        console.log(
          `[RSIL][Optimize] Auto-started A/B for ${weblet.id} with ${governance.abTestTrafficPct}% traffic`
        )
      }

      optimizedCount += 1
    }

    return {
      success: true,
      scanned: weblets.length,
      optimizedCount,
      skippedCount,
    }
  }
)

export const rsilMonitoringCron = inngest.createFunction(
  { id: 'rsil-monitoring-cron' },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const now = new Date()

    const weblets = await step.run('load-rsil-weblets-for-monitoring', async () => {
      return prisma.weblet.findMany({
        where: { rsilEnabled: true },
        select: {
          id: true,
          name: true,
          rsilGovernance: true,
        },
      })
    })

    let monitoredCount = 0
    let rollbackCount = 0

    for (const weblet of weblets) {
      const governance = getGovernance({ rsilGovernance: weblet.rsilGovernance })

      if (!governance.enabled) {
        console.log(`[RSIL][Monitor] Skip ${weblet.id}: governance.disabled`)
        continue
      }

      const activeVersion = await step.run(`monitor-load-active-${weblet.id}`, async () => {
        return prisma.webletVersion.findFirst({
          where: {
            webletId: weblet.id,
            status: 'ACTIVE',
          },
          orderBy: { versionNum: 'desc' },
          select: {
            id: true,
            versionNum: true,
            createdAt: true,
            abTestEndedAt: true,
          },
        })
      })

      if (!activeVersion) {
        console.log(`[RSIL][Monitor] Skip ${weblet.id}: no ACTIVE version`)
        continue
      }

      const promotedAt = activeVersion.abTestEndedAt ?? activeVersion.createdAt
      const hoursSincePromotion = getHoursAgo(promotedAt, now)

      if (hoursSincePromotion > governance.monitoringWindowHours) {
        console.log(
          `[RSIL][Monitor] Skip ${weblet.id}: outside monitoring window (${hoursSincePromotion.toFixed(1)}h > ${governance.monitoringWindowHours}h)`
        )
        continue
      }

      monitoredCount += 1

      const floorCheck = await step.run(`monitor-check-floor-${weblet.id}`, async () => {
        return checkPerformanceFloor(weblet.id, activeVersion.id, governance.performanceFloor)
      })

      if (!floorCheck.belowFloor) {
        console.log(
          `[RSIL][Monitor] OK ${weblet.id}: score=${floorCheck.currentScore.toFixed(3)} floor=${governance.performanceFloor}`
        )
        continue
      }

      const rollback = await step.run(`monitor-rollback-${weblet.id}`, async () => {
        return rollbackVersion(weblet.id)
      })

      rollbackCount += 1
      console.log(
        `[RSIL][Monitor] Rolled back ${weblet.id}: ${rollback.rolledBack.id} -> restored ${rollback.restoredTo.id} ` +
          `(score=${floorCheck.currentScore.toFixed(3)}, floor=${governance.performanceFloor})`
      )
    }

    return {
      success: true,
      scanned: weblets.length,
      monitoredCount,
      rollbackCount,
    }
  }
)
