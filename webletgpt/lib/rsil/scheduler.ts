/**
 * RSIL Scheduler — Inngest function that runs daily to optimize all enabled weblets.
 */

import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { analyzeWeblet } from './analyzer'
import { generateImprovedPrompt } from './generator'
import { createAbTestVersion, getVersionForUser } from './ab-test'
import { deployWinner, evaluateAbTest } from './deployer'
import { checkGovernance } from './governance'

export const rsilDailyOptimizer = inngest.createFunction(
  { id: 'rsil-daily-optimizer', name: 'RSIL Daily Optimizer' },
  { cron: '0 0 * * *' }, // Every day at midnight
  async ({ step, logger }) => {
    // 1. Find all RSIL-enabled weblets
    const weblets = await step.run('fetch-rsil-weblets', async () => {
      return prisma.weblet.findMany({
        where: { rsilEnabled: true, isActive: true },
        select: { id: true, name: true, description: true },
      })
    })

    logger.info(`RSIL: Processing ${weblets.length} weblets`)

    const results: Array<{ webletId: string; action: string }> = []

    for (const weblet of weblets) {
      const result = await step.run(`optimize-${weblet.id}`, async () => {
        try {
          // 1. Check if there's a running test to evaluate first
          const testResult = await evaluateAbTest(weblet.id)
          if (testResult.winner !== 'insufficient_data') {
            const { action } = await deployWinner(weblet.id)
            return { webletId: weblet.id, action: `deployed: ${action}` }
          }

          // 2. Governance check
          const gov = await checkGovernance(weblet.id)
          if (!gov.allowed) {
            return { webletId: weblet.id, action: `skipped: ${gov.reason}` }
          }

          // 3. Analyze performance
          const analysis = await analyzeWeblet(weblet.id, 24)
          if (analysis.decision === 'NONE') {
            return { webletId: weblet.id, action: `no_action: ${analysis.reason}` }
          }

          // 4. Get current active version
          const activeVersion = await prisma.webletVersion.findFirst({
            where: { webletId: weblet.id, status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
          })

          if (!activeVersion) {
            return { webletId: weblet.id, action: 'skipped: no active version' }
          }

          if (analysis.decision === 'SUGGESTION') {
            // Just log — don't auto-update
            logger.info(`RSIL suggestion for ${weblet.name}: ${analysis.reason}`)
            return { webletId: weblet.id, action: `suggestion_queued: ${analysis.reason}` }
          }

          // 5. AUTO_UPDATE — generate improved prompt and start A/B test
          const improvedPrompt = await generateImprovedPrompt({
            currentPrompt: activeVersion.prompt,
            webletId: weblet.id,
            lowScoredTraceIds: analysis.lowScoredTraceIds,
            webletName: weblet.name,
            webletDescription: weblet.description,
          })

          await createAbTestVersion({
            webletId: weblet.id,
            newPrompt: improvedPrompt,
            baseVersionId: activeVersion.id,
            trafficPct: 50,
          })

          return { webletId: weblet.id, action: `ab_test_started: avg_score=${analysis.avgScore.toFixed(2)}` }
        } catch (err: any) {
          logger.error(`RSIL failed for ${weblet.id}: ${err.message}`)
          return { webletId: weblet.id, action: `error: ${err.message}` }
        }
      })

      results.push(result)
    }

    return { processed: weblets.length, results }
  }
)
