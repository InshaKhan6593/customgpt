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
      <div className="bg-muted text-foreground max-w-[85%] rounded-2xl px-5 py-3 flex items-center gap-1">
        <span className="animate-bounce delay-75">.</span>
        <span className="animate-bounce delay-150">.</span>
        <span className="animate-bounce delay-300">.</span>
      </div>
    </div>
  )
}
