"use client"

import { useEffect, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, UIMessage, isToolUIPart } from "ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, RotateCcw, Bot, User, Loader2 } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import { ToolInvocationToggle } from "@/components/chat/tool-invocation-toggle"
import type { BuilderState } from "./builder-layout"

export function PreviewChat({ state, webletId }: { state: BuilderState, webletId: string }) {
  const isNew = webletId === "new"
  const [input, setInput] = useState("")

  // Ref to the scrollable messages container — used for auto-scroll to bottom
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // Sentinel element placed after the last message; we scroll it into view
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, setMessages, sendMessage, status } = useChat({
    id: "preview-chat-session",
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: {
        webletId: isNew ? undefined : webletId,
      },
    }),
  })

  // Clear messages if weblet id changes just to be safe
  useEffect(() => {
    setMessages([])
  }, [webletId, setMessages])

  // Auto-scroll to bottom whenever messages update (including during streaming).
  // We use the scroll container's scrollTop directly rather than scrollIntoView
  // so we have full control and avoid conflicts with the Radix ScrollArea viewport.
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    // Instant scroll keeps up with rapid streaming updates without visual jitter
    el.scrollTop = el.scrollHeight
  }, [messages, status])

  const handleSend = () => {
    if (!input.trim() || isNew) return
    sendMessage({ text: input })
    setInput("")
  }

  const isLoading = status === "submitted" || status === "streaming"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <span className="text-sm font-medium text-muted-foreground">
          Live Preview Mode
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMessages([])}
          title="Reset chat preview"
          disabled={messages.length === 0}
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      {/* Messages — plain div instead of Radix ScrollArea so we can hold a ref
          and call scrollTop directly for reliable auto-scroll during streaming */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-4"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-center">
            {state.iconUrl ? (
              <Avatar className="size-12">
                <AvatarImage src={state.iconUrl} />
                <AvatarFallback className="text-lg bg-muted font-semibold">{(state.name || "W").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            ) : (
              <Bot className="size-12 text-muted-foreground/50" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">
                {state.name || "Your Weblet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isNew ? "Save your Weblet first to enable live chat preview." : "Send a message to preview your setup"}
              </p>
            </div>
            {/* Conversation Starters */}
            {!isNew && state.conversationStarters.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-sm mt-4">
                {state.conversationStarters.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(starter)}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((msg: UIMessage) => (
              <div
                key={msg.id}
                className={`flex w-full gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role !== "user" && (
                  <Avatar className="size-7 shrink-0">
                    {state.iconUrl ? (
                      <AvatarImage src={state.iconUrl} />
                    ) : null}
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-semibold">
                      {(state.name || "W").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`min-w-0 overflow-hidden text-sm ${
                    msg.role === "user"
                      ? "max-w-[80%] rounded-lg px-3 py-2 bg-primary text-primary-foreground"
                      : "max-w-full text-foreground"
                  }`}
                >
                  {msg.parts.map((part, i) => {
                    if (part.type === "text") {
                      if (msg.role === "user") {
                        return <span key={i}>{part.text}</span>
                      }
                      return <ChatMarkdown key={i} content={part.text} />
                    }
                    if (isToolUIPart(part)) {
                      return <ToolInvocationToggle key={i} part={part} />
                    }
                    return null
                  })}
                </div>
                {msg.role === "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted border">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            ))}

            {status === "submitted" && (
              <div className="flex gap-3 items-center">
                <Avatar className="size-7 shrink-0">
                  {state.iconUrl ? (
                    <AvatarImage src={state.iconUrl} />
                  ) : null}
                  <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-semibold">
                    {(state.name || "W").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex gap-1.5 py-2">
                  <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce" />
                  <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-.15s]" />
                  <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-.3s]" />
                </span>
              </div>
            )}

            {/* Invisible sentinel — always sits below the last message */}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!isNew) handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            placeholder={isNew ? "Save Weblet first..." : "Type a message..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
            disabled={isNew || isLoading}
          />
          <Button type="submit" size="icon" disabled={isNew || isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}
