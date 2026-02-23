"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface StarterChipsProps {
  weblet: { name: string; iconUrl: string | null }
  conversationStarters: string[]
  onStarterClick: (starter: string) => void
}

export function StarterChips({ weblet, conversationStarters, onStarterClick }: StarterChipsProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto text-center space-y-8">
      <Avatar className="h-16 w-16 mb-4">
        <AvatarImage src={weblet.iconUrl || undefined} />
        <AvatarFallback className="text-2xl">{weblet.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <h1 className="text-2xl font-bold">How can I help you today?</h1>
      
      {conversationStarters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
          {conversationStarters.map((starter, i) => (
            <button
              key={i}
              onClick={() => onStarterClick(starter)}
              className="p-4 rounded-xl border bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground text-left text-sm transition-colors shadow-sm"
            >
              {starter}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
