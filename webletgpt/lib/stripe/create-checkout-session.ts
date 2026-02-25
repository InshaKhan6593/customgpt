import { stripe } from "./client"

export async function createCheckoutSession({
  userId,
  userEmail,
  webletId,
  priceId,
}: {
  userId: string
  userEmail: string
  webletId: string
  priceId: string
}) {
  // 1. Fetch or create Stripe Customer by email
  const customers = await stripe.customers.list({ email: userEmail, limit: 1 })
  let customerId = customers.data[0]?.id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: userEmail,
      metadata: { userId },
    })
    customerId = customer.id
  }

  // 2. Build the exact return URL
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  // 3. Create the Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/chats?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/marketplace`,
    metadata: {
      userId,
      webletId,
    },
    subscription_data: {
      metadata: {
        userId,
        webletId,
      },
    },
  })

  return session.url
}
