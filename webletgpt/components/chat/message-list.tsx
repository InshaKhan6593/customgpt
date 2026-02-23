"use client"

import { UIMessage } from "ai"
import { StarterChips } from "./starter-chips"
import { MessageBubble } from "./message-bubble"
import { TypingIndicator } from "./typing-indicator"
import { RefObject } from "react"

interface MessageListProps {
  messages: UIMessage[]
  weblet: { name: string; iconUrl: string | null }
  conversationStarters: string[]
  isLoading: boolean
  onStarterClick: (starter: string) => void
  onRateMessage: (messageId: string, rating: "UP" | "DOWN") => void
  scrollRef: RefObject<HTMLDivElement | null>
}

export function MessageList({
  messages,
  weblet,
  conversationStarters,
  isLoading,
  onStarterClick,
  onRateMessage,
  scrollRef
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8" ref={scrollRef}>
      {messages.length === 0 ? (
        <StarterChips 
          weblet={weblet} 
          conversationStarters={conversationStarters} 
          onStarterClick={onStarterClick} 
        />
      ) : (
        <div className="max-w-3xl mx-auto space-y-6 pb-24">
          {messages.map((m) => (
            <MessageBubble 
              key={m.id} 
              message={m} 
              weblet={weblet} 
              onRateMessage={onRateMessage} 
            />
          ))}
          
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <TypingIndicator weblet={weblet} />
          )}
        </div>
      )}
    </div>
  )
}
