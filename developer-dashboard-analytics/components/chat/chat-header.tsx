"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PanelLeft, Bot } from "lucide-react"

interface ChatHeaderProps {
  webletName: string
  onToggleSidebar: () => void
}

export function ChatHeader({ webletName, onToggleSidebar }: ChatHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
      <Button variant="ghost" size="icon" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <PanelLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground">{webletName}</span>
      </div>
      <div className="ml-auto">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/marketplace">Back to Marketplace</Link>
        </Button>
      </div>
    </header>
  )
}
