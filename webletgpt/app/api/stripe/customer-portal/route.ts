import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { stripe } from "@/lib/stripe/client"
import { prisma } from "@/lib/prisma"
import { errorResponse, successResponse } from "@/lib/utils/api-response"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return errorResponse("Unauthorized", 401)

    // Find any existing subscription to easily get the customer ID
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: session.user.id },
    })

    let customerId = subscriptions.find((s) => s.stripeCustomerId)?.stripeCustomerId

    if (!customerId) {
      // Fallback: search by email
      const customers = await stripe.customers.list({
        email: session.user.email as string,
        limit: 1,
      })
      customerId = customers.data[0]?.id
    }

    if (!customerId) {
      return errorResponse("No billing account found. Please subscribe to a Weblet first.", 404)
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/billing`,
    })

    return successResponse({ url: portalSession.url })
  } catch (error: any) {
    console.error("Stripe Portal Error:", error)
    return errorResponse("Internal server error", 500)
  }
}
