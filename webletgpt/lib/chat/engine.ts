import { prisma } from "@/lib/prisma"
import { getVersionForUser } from "@/lib/rsil/ab-test"

export async function getActiveVersion(webletId: string, userId?: string) {
  // If userId provided, check for A/B test routing
  if (userId) {
    try {
      const version = await getVersionForUser(webletId, userId)
      if (version) return version
    } catch {
      // Fall through to default behavior if A/B test routing fails
    }
  }

  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    include: {
      versions: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  })

  if (!weblet || weblet.versions.length === 0) {
    const fallback = await prisma.webletVersion.findFirst({
      where: { webletId },
      orderBy: { createdAt: 'desc' }
    })
    return fallback
  }

  return weblet.versions[0]
}
