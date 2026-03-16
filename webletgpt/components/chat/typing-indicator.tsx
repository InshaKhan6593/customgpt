"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import React from "react"

interface TypingIndicatorProps {
  weblet: { name: string; iconUrl: string | null }
}

export function TypingIndicator({ weblet }: TypingIndicatorProps) {
  return (
    <div className="flex gap-4 justify-start">
      <Avatar className="h-8 w-8 shrink-0 mt-1">
        <AvatarImage src={weblet.iconUrl || undefined} />
        <AvatarFallback>{weblet.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-1.5 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )
}

export default React.memo(TypingIndicator)

