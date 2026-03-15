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
  onMCPAuthComplete?: () => void
  scrollRef: RefObject<HTMLDivElement | null>
}

export function MessageList({
  messages,
  weblet,
  conversationStarters,
  isLoading,
  onStarterClick,
  onRateMessage,
  onMCPAuthComplete,
  scrollRef
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6" ref={scrollRef}>
      {messages.length === 0 ? (
        <StarterChips
          weblet={weblet}
          conversationStarters={conversationStarters}
          onStarterClick={onStarterClick}
        />
      ) : (
        <div className="max-w-2xl w-full mx-auto space-y-5 pb-20 overflow-x-hidden">
          {messages.map((m, idx) => (
            <MessageBubble
              key={m.id}
              message={m}
              weblet={weblet}
              onRateMessage={onRateMessage}
              onMCPAuthComplete={onMCPAuthComplete}
              isStreaming={isLoading && idx === messages.length - 1 && m.role === "assistant"}
            />
          ))}
          
          {isLoading && (() => {
            const lastMsg = messages[messages.length - 1]
            const lastIsUser = lastMsg?.role === "user"
            const lastIsEmptyAssistant = lastMsg?.role === "assistant" && 
              (!lastMsg.parts || lastMsg.parts.filter(p => p.type === "text").every((p: any) => !p.text))
            return (lastIsUser || lastIsEmptyAssistant) ? <TypingIndicator weblet={weblet} /> : null
          })()}
        </div>
      )}
    </div>
  )
}
