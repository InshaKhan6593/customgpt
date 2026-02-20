"use client"

import { Button } from "@/components/ui/button"
import { Bot, User, Copy, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react"
import type { ChatMessage } from "@/app/chat/[id]/page"

interface ChatMessagesProps {
  messages: ChatMessage[]
  isGenerating: boolean
  onRate: (messageId: string, rating: "up" | "down") => void
}

const SUGGESTIONS = [
  "Help me write a Next.js API route",
  "Explain async/await in TypeScript",
  "Generate a marketing tagline",
]

export function ChatMessages({ messages, isGenerating, onRate }: ChatMessagesProps) {
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  // Empty state
  if (messages.length === 0 && !isGenerating) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">How can I help you today?</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "assistant" && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="flex flex-col gap-1.5 max-w-[85%]">
            <div
              className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-border"
              }`}
            >
              {/* Simple markdown-like rendering */}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
            {msg.role === "assistant" && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(msg.content)} aria-label="Copy message">
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${msg.rating === "up" ? "text-primary" : ""}`}
                  onClick={() => onRate(msg.id, "up")}
                  aria-label="Rate positive"
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${msg.rating === "down" ? "text-destructive" : ""}`}
                  onClick={() => onRate(msg.id, "down")}
                  aria-label="Rate negative"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          {msg.role === "user" && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      ))}

      {/* Typing indicator */}
      {isGenerating && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
