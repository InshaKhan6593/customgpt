import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { successResponse, errorResponse } from "@/lib/utils/api-response"
import { createCheckoutSession } from "@/lib/stripe/create-checkout-session"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return errorResponse("Unauthorized", 401)

    const body = await req.json()
    const { webletId } = body

    if (!webletId) return errorResponse("webletId is required", 400)

    const weblet = await prisma.weblet.findUnique({
      where: { id: webletId },
    })

    if (!weblet) return errorResponse("Weblet not found", 404)
    if (!weblet.stripePriceId) {
      return errorResponse("Weblet is not configured for monetization yet", 400)
    }

    const checkoutUrl = await createCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email as string,
      webletId: weblet.id,
      priceId: weblet.stripePriceId,
    })

    if (!checkoutUrl) {
      return errorResponse("Failed to create checkout session", 500)
    }

    return successResponse({ url: checkoutUrl })
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error)
    return errorResponse("Internal server error", 500)
  }
}
