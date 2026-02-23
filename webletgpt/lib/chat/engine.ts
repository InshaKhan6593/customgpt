import { prisma } from "@/lib/prisma"

export async function getActiveVersion(webletId: string) {
  // For segment 05, this simply returns the currently active prompt version
  // In Segment 15, this will handle deterministic hash-based traffic splitting for A/B testing
  
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
    // Fallback: if no ACTIVE version, try the latest version regardless of status
    const fallback = await prisma.webletVersion.findFirst({
      where: { webletId },
      orderBy: { createdAt: 'desc' }
    })
    return fallback
  }

  return weblet.versions[0]
}
