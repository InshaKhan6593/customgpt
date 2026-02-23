"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, RotateCcw, Bot, User } from "lucide-react"
import type { BuilderState } from "./builder-layout"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

export function PreviewChat({ state }: { state: BuilderState }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }
    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "This is a preview placeholder. The live chat engine will be connected in Segment 05.",
      },
    ])
    setInput("")
  }

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
          title="Reset chat"
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
                Send a message to preview the chat experience
              </p>
            </div>
            {/* Conversation Starters */}
            {state.conversationStarters.length > 0 && (
              <div className="flex flex-wrap gap-2 max-w-sm">
                {state.conversationStarters.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(starter)
                    }}
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
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="size-4" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="size-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
