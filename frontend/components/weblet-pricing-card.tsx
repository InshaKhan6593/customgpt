"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Loader2 } from "lucide-react"

interface WebletPricingCardProps {
  webletName: string
  price: number
  isSubscribed?: boolean
}

export function WebletPricingCard({ webletName, price, isSubscribed = false }: WebletPricingCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = () => {
    setIsLoading(true)
    // Simulates redirect to Stripe Checkout
    setTimeout(() => setIsLoading(false), 3000)
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium text-muted-foreground">
          Premium Access to {webletName}
        </CardTitle>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight text-foreground">${price}</span>
          <span className="text-sm text-muted-foreground">/mo</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ul className="flex flex-col gap-3">
          {["Unlimited Chats", "Priority access to standard models", "Support the Creator"].map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-foreground">
              <Check className="h-4 w-4 shrink-0 text-success" />
              {feature}
            </li>
          ))}
        </ul>
        {isSubscribed ? (
          <Button variant="secondary" className="w-full">Manage</Button>
        ) : (
          <Button className="w-full" onClick={handleSubscribe} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              "Subscribe Now"
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
