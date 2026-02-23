import { ENABLE_PAYMENT_ENFORCEMENT } from "@/lib/constants"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function checkAccess(webletId: string) {
  // If payment enforcement is disabled, free access for everyone
  if (!ENABLE_PAYMENT_ENFORCEMENT) {
    return { hasAccess: true, reason: null }
  }

  // When payment enforcement is ON:
  const weblet = await prisma.weblet.findUnique({
    where: { id: webletId },
    select: { monthlyPrice: true, developerId: true, accessType: true }
  })

  // If no weblet, or if access is free based on monthlyPrice or accessType
  if (!weblet || weblet.accessType === "FREE" || !weblet.monthlyPrice || weblet.monthlyPrice === 0) {
    return { hasAccess: true, reason: null }
  }

  const session = await auth()
  
  if (!session?.user?.id) {
    return { hasAccess: false, reason: "UNAUTHORIZED: Please sign in to use this paid weblet." }
  }

  // Developer has free access to their own weblets
  if (session.user.id === weblet.developerId) {
    return { hasAccess: true, reason: null }
  }

  // Check if user has an active subscription platform-wide (since schema doesn't link Sub to Weblet directly)
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE"
    }
  })

  if (!subscription) {
    return { hasAccess: false, reason: "PAYMENT_REQUIRED: You must subscribe to use this weblet." }
  }

  return { hasAccess: true, reason: null }
}
