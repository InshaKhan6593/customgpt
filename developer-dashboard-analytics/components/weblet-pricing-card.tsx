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

  const handleSubscribe = async () => {
    setIsLoading(true)
    // Simulate redirect to Stripe Checkout
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsLoading(false)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Premium Access to {webletName}
        </CardTitle>
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">${price}</span>
          <span className="text-sm text-muted-foreground">/mo</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2.5">
          <li className="flex items-center gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 text-primary" />
            Unlimited Chats
          </li>
          <li className="flex items-center gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 text-primary" />
            Priority access to standard models
          </li>
          <li className="flex items-center gap-2 text-sm text-foreground">
            <Check className="h-4 w-4 text-primary" />
            Support the Creator
          </li>
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
