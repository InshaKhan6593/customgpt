"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface StarterChipsProps {
  weblet: { name: string; iconUrl: string | null }
  conversationStarters: string[]
  onStarterClick: (starter: string) => void
}

export function StarterChips({ weblet, conversationStarters, onStarterClick }: StarterChipsProps) {
  return (
    <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-6">
      <Avatar className="h-16 w-16 mb-4">
        <AvatarImage src={weblet.iconUrl || undefined} />
        <AvatarFallback className="text-2xl">{weblet.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <h1 className="text-lg font-semibold text-foreground/80">How can I help you today?</h1>
      
      {conversationStarters.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
          {conversationStarters.map((starter, i) => (
            <button
              key={i}
              onClick={() => onStarterClick(starter)}
              className="p-3 rounded-lg border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground text-left text-sm transition-colors"
            >
              {starter}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
