import { ENABLE_PAYMENT_ENFORCEMENT } from "@/lib/constants"
import { prisma } from "@/lib/prisma"

/**
 * Check if a user can access a weblet.
 *
 * Accepts pre-fetched weblet data and userId to avoid redundant DB queries.
 * Only hits the DB for the subscription check (paid weblets) — a single query
 * vs the 3 queries the old version made.
 */
export async function checkAccess(
  webletId: string,
  opts?: {
    userId?: string
    developerId?: string | null
    accessType?: string | null
    monthlyPrice?: number | null
  }
) {
  // If payment enforcement is disabled, free access for everyone
  if (!ENABLE_PAYMENT_ENFORCEMENT) {
    return { hasAccess: true, reason: null }
  }

  const accessType = opts?.accessType
  const monthlyPrice = opts?.monthlyPrice

  // Free weblet — no checks needed
  if (accessType === "FREE" || !monthlyPrice || monthlyPrice === 0) {
    return { hasAccess: true, reason: null }
  }

  const userId = opts?.userId
  if (!userId) {
    return { hasAccess: false, reason: "UNAUTHORIZED: Please sign in to use this paid weblet." }
  }

  // Developer has free access to their own weblets
  if (userId === opts?.developerId) {
    return { hasAccess: true, reason: null }
  }

  // Check if user has an active subscription (only DB query in this function)
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" }
  })

  if (!subscription) {
    return { hasAccess: false, reason: "PAYMENT_REQUIRED: You must subscribe to use this weblet." }
  }

  return { hasAccess: true, reason: null }
}
