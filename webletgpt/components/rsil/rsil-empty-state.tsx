"use client"

import { Bot, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function RsilEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <Sparkles className="size-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">
          No RSIL-enabled Weblets
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Reinforcement from System & Instructions Learning (RSIL) automatically improves your Weblets based on user interactions.
        </p>
      </div>
      <Link href="/dashboard/weblets">
        <Button variant="secondary">
          <Bot className="size-4 mr-2" />
          Go to My Weblets
        </Button>
      </Link>
    </div>
  )
}
