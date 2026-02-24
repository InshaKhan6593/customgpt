"use client"

import { useEffect, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, UIMessage } from "ai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, RotateCcw, Bot, User, Loader2 } from "lucide-react"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import type { BuilderState } from "./builder-layout"

export function PreviewChat({ state, webletId }: { state: BuilderState, webletId: string }) {
  const isNew = webletId === "new"
  const [input, setInput] = useState("")

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

  const handleSend = () => {
    if (!input.trim() || isNew) return
    sendMessage({
      text: input,
    })
    setInput("")
  }

  const isLoading = status === "submitted" || status === "streaming"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
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

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-center">
            <Bot className="size-12 text-muted-foreground/50" />
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
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="size-4" />
                  </div>
                )}
                <div
                  className={`min-w-0 max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.parts.map((part, i) => {
                    if (part.type === "text") {
                      if (msg.role === "user") {
                        return <span key={i}>{part.text}</span>
                      }
                      return (
                        <ChatMarkdown key={i} content={part.text} />
                      )
                    }
                    if (part.type === "tool-invocation") {
                      return (
                        <div key={i} className="text-xs text-muted-foreground italic">
                          🔧 Using {(part as any).toolInvocation?.toolName || "tool"}...
                        </div>
                      )
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
              <div className="flex gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="rounded-lg bg-muted px-4 py-3">
                  <span className="flex gap-1">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-.15s]" />
                    <span className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-.3s]" />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
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
