"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
      <div className="bg-muted text-foreground max-w-[85%] rounded-2xl px-5 py-3.5 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  )
}

