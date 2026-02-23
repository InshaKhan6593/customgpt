import { NextRequest } from "next/server"
import { requireRole } from "@/lib/utils/auth-guard"
import { successResponse, errorResponse } from "@/lib/utils/api-response"
import { prisma } from "@/lib/prisma"

// DELETE /api/subscriptions/[id] — Cancel a subscription
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await requireRole("USER")

    const subscription = await prisma.subscription.findUnique({
      where: { id },
    })

    if (!subscription) return errorResponse("Subscription not found", 404)
    if (subscription.userId !== user.id) return errorResponse("Forbidden", 403)

    // Segment 07 will implement:
    // 1. Cancel the Stripe subscription
    // 2. Update local status to CANCELED
    // For now, just update the local record
    const updated = await prisma.subscription.update({
      where: { id },
      data: { status: "CANCELED" },
    })

    return successResponse({ success: true, subscription: updated })
  } catch (err: any) {
    if (err.name === "AuthorizationError") {
      return errorResponse(err.message, err.message.includes("Not auth") ? 401 : 403)
    }
    return errorResponse("Internal server error", 500)
  }
}
