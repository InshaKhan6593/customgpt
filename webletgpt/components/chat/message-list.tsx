"use client"

import { UIMessage, isToolUIPart } from "ai"
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
    <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center px-4">
          <StarterChips
            weblet={weblet}
            conversationStarters={conversationStarters}
            onStarterClick={onStarterClick}
          />
        </div>
      ) : (
        <div className="max-w-[44rem] w-full mx-auto space-y-5 pb-20 px-4 md:px-6 pt-4 md:pt-6 overflow-x-hidden">
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
            // Hide typing indicator as soon as ANY visible content exists in the assistant message —
            // either non-empty text OR a tool invocation part (even while still streaming its args).
            // Previously this only checked text parts, so the dots stayed visible during tool calls,
            // showing two avatars at once and giving the illusion of a delay.
            const hasVisibleContent = lastMsg?.parts?.some(
              (p: any) => (p.type === "text" && p.text?.trim()) || isToolUIPart(p)
            )
            const lastIsEmptyAssistant = lastMsg?.role === "assistant" && !hasVisibleContent
            return (lastIsUser || lastIsEmptyAssistant) ? <TypingIndicator weblet={weblet} /> : null
          })()}
        </div>
      )}
    </div>
  )
}
