"use client"

import { useState } from "react"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface UpgradeCTAProps {
  variant?: "primary" | "secondary"
  source: string
  className?: string
  onClick?: () => void
}

interface WindowWithTracking extends Window {
  __trackUpgradeClick?: (source: string) => void
}

function trackUpgradeClickIfAvailable(source: string) {
  try {
    const win = typeof window !== "undefined" ? (window as WindowWithTracking) : null
    if (win?.__trackUpgradeClick) {
      win.__trackUpgradeClick(source)
    }
  } catch {}
}

export function UpgradeCTA({ variant = "primary", source, className, onClick }: UpgradeCTAProps) {
  const [isNavigating, setIsNavigating] = useState(false)

  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }

    setIsNavigating(true)
    trackUpgradeClickIfAvailable(source)
    window.location.href = "/dashboard/billing"
  }

  if (variant === "secondary") {
    return (
      <Button
        variant="outline"
        size="default"
        onClick={handleClick}
        disabled={isNavigating}
        className={cn(
          "gap-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5",
          className
        )}
      >
        <Sparkles className="h-4 w-4" />
        {isNavigating ? "Loading..." : "Upgrade to Unlock"}
      </Button>
    )
  }

  return (
    <Button
      size="lg"
      onClick={handleClick}
      disabled={isNavigating}
      className={cn("gap-2 sm:min-w-40", className)}
    >
      {isNavigating ? (
        "Loading..."
      ) : (
        <>
          Upgrade Now
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </Button>
  )
}
