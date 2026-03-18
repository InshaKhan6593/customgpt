import { prisma } from '@/lib/prisma'
import { shouldServeVariant } from '@/lib/rsil/ab-test'

export async function getActiveVersion(webletId: string, userId?: string, developerId?: string, isPreview?: boolean) {
  try {
    const versions = await prisma.webletVersion.findMany({
      where: {
        webletId,
        status: { in: ['ACTIVE', 'TESTING'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    const activeVersion = versions.find(v => v.status === 'ACTIVE')
    const testingVersion = versions.find(v => v.status === 'TESTING')

    if (testingVersion && userId && testingVersion.isAbTest) {
      // Developer override: only in preview mode — developer always sees TESTING in builder preview
      if (isPreview && developerId && userId === developerId) {
        console.log(`[engine] Developer preview override: serving TESTING version for weblet ${webletId}`)
        return testingVersion
      }
      // Everyone (including developer in regular chat) gets hash-bucketed by abTestTrafficPct
      const inVariantBucket = shouldServeVariant(userId, webletId, testingVersion.abTestTrafficPct)
      if (inVariantBucket) {
        return testingVersion
      }
      if (activeVersion) {
        return activeVersion
      }
    }

    if (activeVersion) {
      return activeVersion
    }

    return await prisma.webletVersion.findFirst({
      where: { webletId },
      orderBy: { createdAt: 'desc' },
    })
  } catch (error) {
    console.error('[engine] getActiveVersion fallback error:', error)
    return await prisma.webletVersion.findFirst({
      where: { webletId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
