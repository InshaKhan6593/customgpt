/**
 * RSIL A/B Test — deterministic hash-based traffic splitting.
 * Same user always gets same version, preventing cognitive dissonance.
 */

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

/** Deterministically assign a user to control (false) or variant (true) */
export function isInTestGroup(userId: string, webletId: string, trafficPct: number): boolean {
  const hash = createHash('md5').update(`${userId}:${webletId}`).digest('hex')
  const bucket = parseInt(hash.slice(0, 8), 16) % 100
  return bucket < trafficPct
}

/** Get the version to use for a user — respects A/B test if one is running */
export async function getVersionForUser(webletId: string, userId: string) {
  // Check if there's an active A/B test (TESTING version)
  const testingVersion = await prisma.webletVersion.findFirst({
    where: { webletId, status: 'TESTING', isAbTest: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!testingVersion) {
    // No A/B test — return active version
    return prisma.webletVersion.findFirst({
      where: { webletId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    })
  }

  // A/B test is running — deterministically route user
  const inTestGroup = isInTestGroup(userId, webletId, testingVersion.abTestTrafficPct)

  if (inTestGroup) {
    return testingVersion
  }

  return prisma.webletVersion.findFirst({
    where: { webletId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
}

/** Create a new TESTING version for A/B testing */
export async function createAbTestVersion({
  webletId,
  newPrompt,
  baseVersionId,
  trafficPct = 50,
}: {
  webletId: string
  newPrompt: string
  baseVersionId: string
  trafficPct?: number
}) {
  const baseVersion = await prisma.webletVersion.findUnique({ where: { id: baseVersionId } })
  if (!baseVersion) throw new Error('Base version not found')

  const latestVersion = await prisma.webletVersion.findFirst({
    where: { webletId },
    orderBy: { versionNum: 'desc' },
  })

  const newVersionNum = (latestVersion?.versionNum || 0) + 1

  return prisma.webletVersion.create({
    data: {
      webletId,
      versionNum: newVersionNum,
      prompt: newPrompt,
      status: 'TESTING',
      model: baseVersion.model,
      commitMsg: 'RSIL auto-generated variant',
      isAbTest: true,
      abTestTrafficPct: trafficPct,
      abTestStartedAt: new Date(),
    },
  })
}
