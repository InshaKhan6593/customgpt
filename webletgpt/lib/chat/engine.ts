import { prisma } from '@/lib/prisma'
import { shouldServeVariant } from '@/lib/rsil/ab-test'

export async function getActiveVersion(webletId: string, userId?: string, developerId?: string) {
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
      // Developer override: weblet owner always sees the TESTING variant
      if (developerId && userId === developerId) {
        console.log(`[engine] Developer override: serving TESTING version for weblet ${webletId}`)
        return testingVersion
      }
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
