import { headers } from "next/headers"
import Stripe from "stripe"
import { stripe } from "@/lib/stripe/client"
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "@/lib/stripe/webhook-handlers"

// Force this route to always run dynamically (never cached)
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get("Stripe-Signature") as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ""

  let event: Stripe.Event

  // In development without a real Stripe CLI webhook secret (whsec_...),
  // skip signature verification so you can test without the CLI.
  const isDev = process.env.NODE_ENV !== "production"
  const hasRealSecret = webhookSecret.startsWith("whsec_")

  if (isDev && !hasRealSecret) {
    // Parse event directly from body (no signature check)
    try {
      event = JSON.parse(body) as Stripe.Event
    } catch (err: any) {
      console.error("Failed to parse webhook body:", err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }
  } else {
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }
  }

  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        )
        break
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        )
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        )
        break
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      default:
        console.log(`Unhandled event type ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error: any) {
    console.error("Webhook handler error:", error)
    return new Response("Webhook handler failed", { status: 500 })
  }
}
