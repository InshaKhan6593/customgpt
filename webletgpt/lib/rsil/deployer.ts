import type { WebletVersion } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { analyzeVersion } from '@/lib/rsil/analyzer'

export async function startABTest(params: {
  webletId: string
  draftVersionId: string
  trafficPct: number
}): Promise<WebletVersion> {
  try {
    const version = await prisma.webletVersion.findUnique({
      where: { id: params.draftVersionId },
    })

    if (!version) {
      throw new Error(`Version ${params.draftVersionId} not found`)
    }

    if (version.webletId !== params.webletId) {
      throw new Error(
        `Version ${params.draftVersionId} does not belong to weblet ${params.webletId}`
      )
    }

    if (version.status !== 'DRAFT') {
      throw new Error(
        `Version ${params.draftVersionId} is not in DRAFT status (current: ${version.status})`
      )
    }

    const existingTesting = await prisma.webletVersion.findFirst({
      where: {
        webletId: params.webletId,
        status: 'TESTING',
      },
    })

    if (existingTesting) {
      throw new Error(
        `Weblet ${params.webletId} already has a TESTING version (${existingTesting.id})`
      )
    }

    const [updated] = await prisma.$transaction([
      prisma.webletVersion.update({
        where: { id: params.draftVersionId },
        data: {
          status: 'TESTING',
          isAbTest: true,
          abTestTrafficPct: params.trafficPct,
          abTestStartedAt: new Date(),
        },
      }),
    ])

    return updated
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`startABTest failed: ${message}`)
  }
}

export async function concludeABTest(
  webletId: string,
  winnerId: string
): Promise<void> {
  try {
    const winner = await prisma.webletVersion.findUnique({
      where: { id: winnerId },
    })

    if (!winner) {
      throw new Error(`Winner version ${winnerId} not found`)
    }

    if (winner.webletId !== webletId) {
      throw new Error(`Winner version ${winnerId} does not belong to weblet ${webletId}`)
    }

    if (winner.status !== 'TESTING') {
      throw new Error(
        `Winner version ${winnerId} must be TESTING (current: ${winner.status})`
      )
    }

    const loser = await prisma.webletVersion.findFirst({
      where: {
        webletId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!loser) {
      throw new Error(`No ACTIVE control version found for weblet ${webletId}`)
    }

    const endedAt = new Date()

    await prisma.$transaction([
      prisma.webletVersion.update({
        where: { id: winner.id },
        data: {
          abTestWinner: true,
          abTestEndedAt: endedAt,
        },
      }),
      prisma.webletVersion.update({
        where: { id: loser.id },
        data: {
          abTestWinner: false,
          abTestEndedAt: endedAt,
        },
      }),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`concludeABTest failed: ${message}`)
  }
}

export async function promoteVersion(
  webletId: string,
  versionId: string,
  strategy: 'instant' | 'canary',
  canaryStages?: number[]
): Promise<void> {
  try {
    const version = await prisma.webletVersion.findUnique({
      where: { id: versionId },
    })

    if (!version) {
      throw new Error(`Version ${versionId} not found`)
    }

    if (version.webletId !== webletId) {
      throw new Error(`Version ${versionId} does not belong to weblet ${webletId}`)
    }

    if (strategy === 'instant') {
      await prisma.$transaction([
        prisma.webletVersion.updateMany({
          where: {
            webletId,
            status: 'ACTIVE',
          },
          data: {
            status: 'ARCHIVED',
          },
        }),
        prisma.webletVersion.update({
          where: { id: versionId },
          data: {
            status: 'ACTIVE',
            isAbTest: false,
            abTestTrafficPct: 100,
          },
        }),
      ])

      return
    }

    const firstStage = (canaryStages ?? [10, 50, 100])[0]

    await prisma.$transaction([
      prisma.webletVersion.update({
        where: { id: versionId },
        data: {
          status: 'TESTING',
          isAbTest: true,
          abTestWinner: true,
          abTestTrafficPct: firstStage,
        },
      }),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`promoteVersion failed: ${message}`)
  }
}

export async function advanceCanary(
  webletId: string,
  versionId: string,
  stages: number[]
): Promise<{ nextStage: number | null; currentStage: number }> {
  try {
    const version = await prisma.webletVersion.findUnique({
      where: { id: versionId },
    })

    if (!version) {
      throw new Error(`Version ${versionId} not found`)
    }

    if (version.webletId !== webletId) {
      throw new Error(`Version ${versionId} does not belong to weblet ${webletId}`)
    }

    const currentPct = version.abTestTrafficPct
    const currentIndex = stages.indexOf(currentPct)

    if (currentIndex === -1 || currentPct >= 100 || currentIndex >= stages.length - 1) {
      await _finalizeCanary(webletId, versionId)
      return { nextStage: null, currentStage: currentPct }
    }

    const nextStage = stages[currentIndex + 1]

    if (nextStage === 100) {
      await _finalizeCanary(webletId, versionId)
      return { nextStage: null, currentStage: 100 }
    }

    await prisma.webletVersion.update({
      where: { id: versionId },
      data: {
        abTestTrafficPct: nextStage,
      },
    })

    return { nextStage, currentStage: currentPct }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`advanceCanary failed: ${message}`)
  }
}

async function _finalizeCanary(webletId: string, versionId: string): Promise<void> {
  await prisma.$transaction([
    prisma.webletVersion.updateMany({
      where: {
        webletId,
        status: 'ACTIVE',
      },
      data: {
        status: 'ARCHIVED',
      },
    }),
    prisma.webletVersion.update({
      where: { id: versionId },
      data: {
        status: 'ACTIVE',
        isAbTest: false,
        abTestTrafficPct: 100,
      },
    }),
  ])
}

export async function rollbackVersion(
  webletId: string
): Promise<{ rolledBack: WebletVersion; restoredTo: WebletVersion }> {
  try {
    const testingWinner = await prisma.webletVersion.findFirst({
      where: {
        webletId,
        status: 'TESTING',
        isAbTest: true,
        abTestWinner: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (testingWinner) {
      const activeVersion = await prisma.webletVersion.findFirst({
        where: {
          webletId,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!activeVersion) {
        throw new Error(`No ACTIVE version to restore for weblet ${webletId}`)
      }

      const [rolledBack] = await prisma.$transaction([
        prisma.webletVersion.update({
          where: { id: testingWinner.id },
          data: {
            status: 'ROLLED_BACK',
            isAbTest: false,
            abTestEndedAt: new Date(),
            abTestWinner: false,
          },
        }),
      ])

      return { rolledBack, restoredTo: activeVersion }
    }

    const activeVersion = await prisma.webletVersion.findFirst({
      where: {
        webletId,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeVersion) {
      throw new Error(`No ACTIVE version found for weblet ${webletId}`)
    }

    const archivedVersion = await prisma.webletVersion.findFirst({
      where: {
        webletId,
        status: 'ARCHIVED',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!archivedVersion) {
      throw new Error(`No ARCHIVED version available to restore for weblet ${webletId}`)
    }

    const [rolledBack, restoredTo] = await prisma.$transaction([
      prisma.webletVersion.update({
        where: { id: activeVersion.id },
        data: {
          status: 'ROLLED_BACK',
        },
      }),
      prisma.webletVersion.update({
        where: { id: archivedVersion.id },
        data: {
          status: 'ACTIVE',
          isAbTest: false,
          abTestWinner: null,
          abTestEndedAt: null,
          abTestTrafficPct: 100,
        },
      }),
    ])

    return { rolledBack, restoredTo }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`rollbackVersion failed: ${message}`)
  }
}

export async function checkPerformanceFloor(
  webletId: string,
  versionId: string,
  floor: number
): Promise<{ belowFloor: boolean; currentScore: number }> {
  try {
    const result = await analyzeVersion(webletId, versionId, 24)

    if (result.sampleSize === 0) {
      return { belowFloor: false, currentScore: 1 }
    }

    return {
      belowFloor: result.compositeScore < floor,
      currentScore: result.compositeScore,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`checkPerformanceFloor failed: ${message}`)
  }
}
