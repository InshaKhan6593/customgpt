import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/utils/auth-guard'
import { prisma } from '@/lib/prisma'
import { RSILSidebar } from '@/components/rsil/rsil-sidebar'

interface RSILWebletLayoutProps {
  children: React.ReactNode
  params: Promise<{ webletId: string }>
}

export default async function RSILWebletLayout({
  children,
  params,
}: RSILWebletLayoutProps) {
  const { webletId } = await params

  // Authenticate user
  let user
  try {
    user = await requireRole('DEVELOPER')
  } catch {
    // If auth fails, trigger 404 to avoid leaking weblet existence
    notFound()
  }

  // Fetch weblet with strict ownership and RSIL validation
  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    select: {
      id: true,
      name: true,
      developerId: true,
      rsilEnabled: true,
    },
  })

  // Trigger 404 if weblet doesn't exist, not owned by user, or RSIL not enabled
  if (!weblet || weblet.developerId !== user.id || !weblet.rsilEnabled) {
    notFound()
  }

  return (
    <div className="flex h-full">
      <RSILSidebar webletId={weblet.id} webletName={weblet.name} />
      <div className="min-w-0 flex-1 overflow-auto pl-6">{children}</div>
    </div>
  )
}
