"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface PricingCardProps {
  webletId: string
  webletName: string
  priceAmount: number
  isSubscribed?: boolean
}

export function PricingCard({
  webletId,
  webletName,
  priceAmount,
  isSubscribed = false,
}: PricingCardProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    setIsLoading(true)
    try {
      // Future: Redirect to /api/stripe/create-checkout
      // const res = await fetch('/api/stripe/create-checkout', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ webletId })
      // })
      // const { url } = await res.json()
      // window.location.href = url

      // Mock loading for now
      await new Promise((resolve) => setTimeout(resolve, 1500))
      
      // Temporary alert since Stripe backend isn't hooked up yet
      alert("Stripe Checkout will be implemented in the backend phase.")
    } catch (error) {
      console.error("Subscription Error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleManage = () => {
    // Future: Redirect to stripe customer portal
    window.location.href = "/billing"
  }

  return (
    <Card className="w-full max-w-sm flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl">
          Premium Access to <span className="text-primary">{webletName}</span>
        </CardTitle>
        <CardDescription>
          Unlock the full capabilities of this AI agent.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-1">
        <div className="mb-6 flex items-baseline text-4xl font-extrabold">
          ${priceAmount.toFixed(2)}
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            /mo
          </span>
        </div>

        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-2">
            <Check className="size-4 text-green-500" />
            <span>Unlimited Chats</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 text-green-500" />
            <span>Priority access to standard models</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 text-green-500" />
            <span>Support the Creator</span>
          </li>
        </ul>
      </CardContent>
      
      <CardFooter>
        {isSubscribed ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleManage}
            disabled={isLoading}
          >
            Manage Subscription
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={handleSubscribe}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isLoading ? "Redirecting to checkout..." : "Subscribe Now"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
