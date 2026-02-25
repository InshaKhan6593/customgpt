"use client"

import { Button } from "@/components/ui/button"
import { Lock, Loader2 } from "lucide-react"
import { useState } from "react"

export function Paywall({
  webletId,
  webletName,
  monthlyPrice,
}: {
  webletId: string
  webletName: string
  monthlyPrice: number
}) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId }),
      })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        alert("Failed to start checkout. Please try again.")
      }
    } catch (err) {
      console.error(err)
      alert("Something went wrong.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 border rounded-lg bg-muted/30 text-center max-w-sm mx-auto mt-12 mb-8">
      <div className="p-4 bg-muted rounded-full mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-bold mb-2">Unlock {webletName}</h3>
      <p className="text-muted-foreground mb-6 text-sm">
        This weblet requires a premium subscription to access. Subscribe for just $
        {monthlyPrice.toFixed(2)}/month to unlock full capabilities.
      </p>
      <Button onClick={handleSubscribe} className="w-full" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isLoading ? "Redirecting..." : "Subscribe Now"}
      </Button>
    </div>
  )
}
