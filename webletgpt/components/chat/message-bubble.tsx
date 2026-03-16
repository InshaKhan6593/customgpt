"use client"

import { useState, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react"
import { UIMessage, isToolUIPart } from "ai"
import { toast } from "sonner"
import React from "react"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import { ToolInvocationToggle } from "./tool-invocation-toggle"

// ── Main Component ──
interface MessageBubbleProps {
  message: UIMessage
  weblet: { name: string; iconUrl: string | null }
  onRateMessage: (messageId: string, rating: "UP" | "DOWN") => void
  onMCPAuthComplete?: () => void
  isStreaming?: boolean
}

export function MessageBubble({ message, weblet, onRateMessage, onMCPAuthComplete, isStreaming = false }: MessageBubbleProps) {
  const getMessageText = (parts: UIMessage["parts"] = []) => {
    return parts.filter(p => p.type === "text").map((p: any) => p.text).join("\n")
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("Copied to clipboard")
  }

  const textContent = getMessageText(message.parts)

  const hasToolParts = message.parts.some(p => isToolUIPart(p))
  // Hide the bubble when it has nothing visible to show. When streaming with no content yet,
  // return null so TypingIndicator handles the loading state (avoids double avatar).
  if (message.role === "assistant" && textContent.length === 0 && !hasToolParts) {
    return null
  }

  // ── User message ──
  if (message.role === "user") {
    return (
      <div className="flex gap-2.5 group justify-end w-full">
        <div className="max-w-[80%] min-w-0">
          {textContent.length > 0 && (
            <div className="rounded-lg px-3.5 py-2 bg-primary text-primary-foreground text-[14px] shadow-sm break-words whitespace-pre-wrap">
              {textContent}
            </div>
          )}
        </div>
        <Avatar className="h-7 w-7 shrink-0 mt-0.5 shadow-sm">
          <AvatarFallback className="bg-primary/90 text-primary-foreground text-[10px] font-semibold">U</AvatarFallback>
        </Avatar>
      </div>
    )
  }

  // ── Assistant message ──
  return (
    <div className="flex gap-2.5 group justify-start w-full">
      <Avatar className="h-7 w-7 shrink-0 mt-0.5 shadow-sm border border-border/50">
        <AvatarImage src={weblet.iconUrl || undefined} />
        <AvatarFallback className="text-[10px] bg-muted font-semibold">{weblet.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-1.5 max-w-[calc(100%-2.5rem)]">
        {message.parts.map((part, i) => {
          if (part.type === "step-start" && i > 0) {
            return <div key={i} className="border-t border-border/40 my-2" />
          }
          if (part.type === "text" && part.text.trim()) {
            return <ChatMarkdown key={i} content={part.text} />
          }
          if (isToolUIPart(part)) {
            return <ToolInvocationToggle key={i} part={part} onMCPAuthComplete={onMCPAuthComplete} />
          }
          return null
        })}

        {/* Message actions — hidden while streaming */}
        <div className={`flex items-center gap-0.5 transition-opacity ${isStreaming ? "hidden" : "opacity-0 group-hover:opacity-100"}`}>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleCopy(textContent)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onRateMessage(message.id, "UP")}>
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onRateMessage(message.id, "DOWN")}>
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
