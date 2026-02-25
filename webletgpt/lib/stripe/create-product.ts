import { stripe } from "./client"

export async function createStripeProduct(
  name: string,
  webletId: string,
  monthlyPrice: number
) {
  // 1. Create the Stripe Product
  const product = await stripe.products.create({
    name: `Premium Access: ${name}`,
    description: `Monthly subscription for the AI agent ${name}`,
    metadata: {
      webletId,
    },
  })

  // 2. Create the recurring Price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(monthlyPrice * 100), // convert dollars to cents
    currency: "usd",
    recurring: { interval: "month" },
  })

  return {
    productId: product.id,
    priceId: price.id,
  }
}
