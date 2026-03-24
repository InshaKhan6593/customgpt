import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { analyzeVersion } from '@/lib/rsil/analyzer'
import {
  rollbackVersion,
  checkPerformanceFloor,
  startABTest,
  concludeABTest,
  promoteVersion,
  advanceCanary,
} from '@/lib/rsil/deployer'
import { generateImprovedPrompt } from '@/lib/rsil/generator'
import { getABTestStatus } from '@/lib/rsil/ab-test'
import { getGovernance } from '@/lib/rsil/governance'
import { notifyDeveloper } from '@/lib/rsil/notifications'

const HOURS_IN_MS = 60 * 60 * 1000
const DAILY_FREQUENCY_HOURS = 24
const WEEKLY_FREQUENCY_DAYS = 7
const ANALYSIS_LOOKBACK_HOURS = 24
const INITIAL_VERSION_NUMBER = 0
const VERSION_INCREMENT = 1
const COMMIT_SCORE_DECIMAL_PLACES = 3

type WinnerType = 'control' | 'variant' | 'none'
type WinnerStatus = NonNullable<Awaited<ReturnType<typeof getABTestStatus>>>

function getWinnerFromTestStatus(
  testStatus: Pick<WinnerStatus, 'significance' | 'maxDurationReached' | 'durationWinner'>
): WinnerType {
  const significanceWinner = testStatus.significance?.winner
  if (significanceWinner && significanceWinner !== 'none') {
    return significanceWinner
  }

  if (!testStatus.maxDurationReached) {
    return 'none'
  }

  if (testStatus.durationWinner === 'none') {
    return 'none'
  }

  return testStatus.durationWinner
}

function getFrequencyHours(frequency: 'daily' | 'weekly' | 'manual'): number | null {
  if (frequency === 'manual') {
    return null
  }

  return frequency === 'daily'
    ? DAILY_FREQUENCY_HOURS
    : DAILY_FREQUENCY_HOURS * WEEKLY_FREQUENCY_DAYS
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
        continue
      }

      const frequencyHours = getFrequencyHours(governance.optimizationFrequency)
      if (frequencyHours === null) {
        skippedCount += 1
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
        // Check if this A/B test is ready to conclude
        const testStatus = await step.run(`check-ab-test-status-${weblet.id}`, async () => {
          return getABTestStatus(weblet.id, {
            minTestDurationHours: governance.minTestDurationHours,
            maxTestDurationHours: governance.maxTestDurationHours,
            minScoresPerVersion: governance.minScoresPerVersion,
            significanceThreshold: governance.significanceThreshold,
            goodScoreThreshold: governance.goodScoreThreshold,
          })
        })

        const winner = testStatus?.canConclude ? getWinnerFromTestStatus(testStatus) : 'none'

        if (testStatus && winner !== 'none') {
          const winnerVersionId =
            winner === 'variant'
              ? testStatus.variantVersion.id
              : testStatus.controlVersion.id

          await step.run(`conclude-ab-test-${weblet.id}`, async () => {
            return concludeABTest(weblet.id, winnerVersionId)
          })

          await step.run(`notify-ab-test-concluded-${weblet.id}`, async () => {
            try {
              await notifyDeveloper({
                webletId: weblet.id,
                eventType: 'rsil.ab-test-concluded',
                notificationType: 'ab_test_concluded',
                title: 'RSIL A/B test concluded',
                message: `Winner selected for ${weblet.name}: ${winner} version promoted.`,
                severity: 'info',
                context: {
                  winner,
                  winnerVersionId,
                  controlVersionId: testStatus.controlVersion.id,
                  variantVersionId: testStatus.variantVersion.id,
                },
              })
            } catch (error) {
              console.warn('[rsil] Failed to emit A/B concluded notification:', error)
            }
          })

          await step.run(`promote-winner-${weblet.id}`, async () => {
            return promoteVersion(
              weblet.id,
              winnerVersionId,
              governance.deploymentStrategy,
              governance.canaryStages
            )
          })
        }

        skippedCount += 1
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
        continue
      }

      const promotedAt = activeVersion.abTestEndedAt ?? activeVersion.createdAt
      const hoursSincePromotion = getHoursAgo(promotedAt, now)
      if (hoursSincePromotion < governance.cooldownHours) {
        skippedCount += 1
        continue
      }

      const analysis = await step.run(`analyze-active-version-${weblet.id}`, async () => {
        return analyzeVersion(weblet.id, activeVersion.id, ANALYSIS_LOOKBACK_HOURS)
      })

      if (analysis.compositeScore >= governance.optimizationScoreThreshold) {
        skippedCount += 1
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
            versionNum: (maxVersion?.versionNum ?? INITIAL_VERSION_NUMBER) + VERSION_INCREMENT,
            commitMsg: [
              `RSIL optimization from v${activeVersion.versionNum}.`,
              `score=${analysis.compositeScore.toFixed(COMMIT_SCORE_DECIMAL_PLACES)} weak=[${analysis.weakDimensions.join(', ') || 'none'}].`,
              `strategy=${governance.deploymentStrategy} canaryStages=[${governance.canaryStages.join(',')}].`,
              `approvalRequired=${governance.requireApproval}.`,
              generation.changelog,
            ].join(' '),
          },
        })
      })

      if (!governance.requireApproval) {
        await step.run(`start-ab-test-${weblet.id}`, async () => {
          return startABTest({
            webletId: weblet.id,
            draftVersionId: draftVersion.id,
            trafficPct: governance.abTestTrafficPct,
          })
        })
      } else {
        await step.run(`notify-approval-required-${weblet.id}`, async () => {
          try {
            await notifyDeveloper({
              webletId: weblet.id,
              eventType: 'rsil.approval-required',
              notificationType: 'approval_required',
              title: 'RSIL draft awaiting approval',
              message: `Draft v${draftVersion.versionNum} is ready for review before A/B test.`,
              severity: 'warning',
              context: {
                draftVersionId: draftVersion.id,
                draftVersionNum: draftVersion.versionNum,
                activeVersionId: activeVersion.id,
                activeVersionNum: activeVersion.versionNum,
                compositeScore: analysis.compositeScore,
              },
            })
          } catch (error) {
            console.warn('[rsil] Failed to emit approval-required notification:', error)
          }
        })
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
        continue
      }

      const canaryCandidate = await step.run(`monitor-load-canary-${weblet.id}`, async () => {
        return prisma.webletVersion.findFirst({
          where: {
            webletId: weblet.id,
            status: 'TESTING',
            isAbTest: true,
            abTestWinner: true,
          },
          orderBy: { versionNum: 'desc' },
          select: {
            id: true,
            versionNum: true,
            abTestTrafficPct: true,
          },
        })
      })

      if (canaryCandidate) {
        monitoredCount += 1

        const canaryFloorCheck = await step.run(`monitor-check-canary-floor-${weblet.id}`, async () => {
          return checkPerformanceFloor(weblet.id, canaryCandidate.id, governance.performanceFloor)
        })

        if (canaryFloorCheck.belowFloor) {
          await step.run(`monitor-rollback-canary-${weblet.id}`, async () => {
            return rollbackVersion(weblet.id)
          })

          rollbackCount += 1

          await step.run(`notify-rollback-canary-${weblet.id}`, async () => {
            try {
              await notifyDeveloper({
                webletId: weblet.id,
                eventType: 'rsil.rollback-triggered',
                notificationType: 'rollback_triggered',
                title: 'RSIL canary rollback triggered',
                message: `Canary v${canaryCandidate.versionNum} underperformed and was rolled back.`,
                severity: 'error',
                context: {
                  rollbackType: 'canary',
                  canaryVersionId: canaryCandidate.id,
                  canaryVersionNum: canaryCandidate.versionNum,
                  currentScore: canaryFloorCheck.currentScore,
                  performanceFloor: governance.performanceFloor,
                },
              })
            } catch (error) {
              console.warn('[rsil] Failed to emit canary rollback notification:', error)
            }
          })

          continue
        }

        const advancement = await step.run(`monitor-advance-canary-${weblet.id}`, async () => {
          return advanceCanary(weblet.id, canaryCandidate.id, governance.canaryStages)
        })

        if (advancement.nextStage !== null) {
          await step.run(`notify-canary-advanced-${weblet.id}`, async () => {
            try {
              await notifyDeveloper({
                webletId: weblet.id,
                eventType: 'rsil.canary-advanced',
                notificationType: 'canary_advanced',
                title: 'RSIL canary advanced',
                message: `Canary v${canaryCandidate.versionNum} advanced from ${advancement.currentStage}% to ${advancement.nextStage}% traffic.`,
                severity: 'info',
                context: {
                  canaryVersionId: canaryCandidate.id,
                  canaryVersionNum: canaryCandidate.versionNum,
                  fromTrafficPct: advancement.currentStage,
                  toTrafficPct: advancement.nextStage,
                },
              })
            } catch (error) {
              console.warn('[rsil] Failed to emit canary advanced notification:', error)
            }
          })
        }

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
        continue
      }

      const promotedAt = activeVersion.abTestEndedAt ?? activeVersion.createdAt
      const hoursSincePromotion = getHoursAgo(promotedAt, now)

      if (hoursSincePromotion > governance.monitoringWindowHours) {
        continue
      }

      monitoredCount += 1

      const floorCheck = await step.run(`monitor-check-floor-${weblet.id}`, async () => {
        return checkPerformanceFloor(weblet.id, activeVersion.id, governance.performanceFloor)
      })

      if (!floorCheck.belowFloor) {
        continue
      }

      const rollback = await step.run(`monitor-rollback-${weblet.id}`, async () => {
        return rollbackVersion(weblet.id)
      })

      rollbackCount += 1

      await step.run(`notify-rollback-active-${weblet.id}`, async () => {
        try {
          await notifyDeveloper({
            webletId: weblet.id,
            eventType: 'rsil.rollback-triggered',
            notificationType: 'rollback_triggered',
            title: 'RSIL rollback triggered',
            message: `Active version v${activeVersion.versionNum} dropped below performance floor and was rolled back.`,
            severity: 'error',
            context: {
              rollbackType: 'active',
              activeVersionId: activeVersion.id,
              activeVersionNum: activeVersion.versionNum,
              currentScore: floorCheck.currentScore,
              performanceFloor: governance.performanceFloor,
            },
          })
        } catch (error) {
          console.warn('[rsil] Failed to emit active rollback notification:', error)
        }
      })
    }

    return {
      success: true,
      scanned: weblets.length,
      monitoredCount,
      rollbackCount,
    }
  }
)
