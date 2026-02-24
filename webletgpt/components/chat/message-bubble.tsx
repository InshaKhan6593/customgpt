"use client"

import { useState, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react"
import { UIMessage } from "ai"
import { toast } from "sonner"
import React from "react"
import { ChatMarkdown } from "@/components/ui/chat-markdown"

// ── Main Component ──
interface MessageBubbleProps {
  message: UIMessage
  weblet: { name: string; iconUrl: string | null }
  onRateMessage: (messageId: string, rating: "UP" | "DOWN") => void
}

export function MessageBubble({ message, weblet, onRateMessage }: MessageBubbleProps) {
  const getMessageText = (parts: UIMessage["parts"] = []) => {
    return parts.filter(p => p.type === "text").map((p: any) => p.text).join("\n")
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success("Copied to clipboard")
  }

  const textContent = getMessageText(message.parts)

  if (message.role === "assistant" && textContent.length === 0) {
    return null
  }

  // ── User message ──
  if (message.role === "user") {
    return (
      <div className="flex gap-3 group justify-end w-full">
        <div className="max-w-[80%] min-w-0">
          {textContent.length > 0 && (
            <div className="rounded-2xl px-4 py-2 bg-primary text-primary-foreground text-[15px] shadow-sm break-words whitespace-pre-wrap">
              {textContent}
            </div>
          )}
        </div>
        <Avatar className="h-8 w-8 shrink-0 mt-0.5 shadow-sm">
          <AvatarFallback className="bg-primary/90 text-primary-foreground text-xs font-semibold">U</AvatarFallback>
        </Avatar>
      </div>
    )
  }

  // ── Assistant message ──
  return (
    <div className="flex gap-4 group justify-start w-full">
      <Avatar className="h-8 w-8 shrink-0 mt-0.5 shadow-sm border border-border/50">
        <AvatarImage src={weblet.iconUrl || undefined} />
        <AvatarFallback className="text-xs bg-muted font-semibold">{weblet.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 space-y-2 max-w-[calc(100%-3rem)]">
        {textContent.length > 0 && (
          <ChatMarkdown content={textContent} />
        )}

        {/* Message actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
