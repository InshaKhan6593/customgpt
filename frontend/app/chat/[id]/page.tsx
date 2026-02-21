"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Plus,
  Trash2,
  Send,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  RotateCcw,
  Paperclip,
  Zap,
  Bot,
} from "lucide-react"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  toolCall?: string
}

const MOCK_HISTORY = [
  { id: "1", title: "Help with Next.js code..." },
  { id: "2", title: "Marketing strategy for SaaS..." },
  { id: "3", title: "Analyze Q4 revenue data..." },
  { id: "4", title: "Write a blog post about AI..." },
]

const SUGGESTIONS = [
  "Help me write a Python function",
  "Explain machine learning to me",
  "Create a marketing plan",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [history, setHistory] = useState(MOCK_HISTORY)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null)
  const [hoveredHistory, setHoveredHistory] = useState<string | null>(null)
  const [ratings, setRatings] = useState<Record<string, "up" | "down">>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (text?: string) => {
    const msg = text || input.trim()
    if (!msg || isStreaming) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsStreaming(true)

    // Simulate tool call then response
    const toolMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "", toolCall: "Searching the web for relevant information..." }
    setTimeout(() => {
      setMessages((prev) => [...prev, toolMsg])
    }, 500)

    setTimeout(() => {
      setMessages((prev) => {
        const withoutTool = prev.filter((m) => m.id !== toolMsg.id)
        return [...withoutTool, {
          id: (Date.now() + 2).toString(),
          role: "assistant" as const,
          content: "Here's what I found based on your request. This is a simulated response that demonstrates **markdown support**, including:\n\n- **Bold text** and *italic text*\n- Bulleted lists\n- `inline code`\n\n```python\ndef hello_world():\n    print(\"Hello, World!\")\n```\n\nLet me know if you need anything else!",
        }]
      })
      setIsStreaming(false)
    }, 2500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([])
    setRatings({})
  }

  const deleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id))
  }

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("```")) {
        return null // simplified: skip code fence lines
      }
      if (line.startsWith("- ")) {
        const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, '<code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">$1</code>')
        return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: content }} />
      }
      if (line.startsWith("    ") || line.startsWith("\t")) {
        return <pre key={i} className="my-1 rounded bg-muted p-2 font-mono text-xs leading-relaxed">{line}</pre>
      }
      const formatted = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/`(.+?)`/g, '<code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">$1</code>')
      if (line.trim() === "") return <br key={i} />
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: formatted }} />
    })
  }

  const isEmpty = messages.length === 0

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
          <div className="p-3">
            <Link href="/chat/new">
              <Button className="w-full gap-2" size="sm">
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </Link>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="flex flex-col gap-0.5 pb-3">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="group relative flex items-center rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onMouseEnter={() => setHoveredHistory(h.id)}
                  onMouseLeave={() => setHoveredHistory(null)}
                >
                  <span className="flex-1 truncate">{h.title}</span>
                  {hoveredHistory === h.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteHistory(h.id)}
                      aria-label={`Delete chat: ${h.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t border-border p-3">
            <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground">WebletGPT</span>
            </Link>
          </div>
        </aside>

        {/* Main Chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Chat Header */}
          <header className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">CB</AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">Codebot 3000</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} aria-label="Reset chat">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear chat</TooltipContent>
            </Tooltip>
          </header>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {isEmpty ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">How can I help you today?</h2>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => handleSend(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl px-4 py-6">
                <div className="flex flex-col gap-6">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      onMouseEnter={() => msg.role === "assistant" && setHoveredMsg(msg.id)}
                      onMouseLeave={() => setHoveredMsg(null)}
                    >
                      {msg.toolCall ? (
                        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {msg.toolCall}
                        </div>
                      ) : msg.role === "user" ? (
                        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="group relative max-w-[85%]">
                          <div className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground">
                            {renderMarkdown(msg.content)}
                          </div>
                          {hoveredMsg === msg.id && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => navigator.clipboard.writeText(msg.content)}
                                    aria-label="Copy message"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-7 w-7 ${ratings[msg.id] === "up" ? "text-success" : ""}`}
                                    onClick={() => setRatings((prev) => ({ ...prev, [msg.id]: "up" }))}
                                    aria-label="Thumbs up"
                                  >
                                    <ThumbsUp className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Good response</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={`h-7 w-7 ${ratings[msg.id] === "down" ? "text-destructive" : ""}`}
                                    onClick={() => {
                                      setRatings((prev) => ({ ...prev, [msg.id]: "down" }))
                                      setFeedbackOpen(true)
                                    }}
                                    aria-label="Thumbs down"
                                  >
                                    <ThumbsDown className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Bad response</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {isStreaming && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                        <span className="flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-border bg-card px-4 py-3">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Attach file">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  disabled={isStreaming}
                  rows={1}
                  className="max-h-32 min-h-[36px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isStreaming}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Modal */}
        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Provide Feedback</DialogTitle>
              <DialogDescription>Help us improve this Weblet by telling us what went wrong.</DialogDescription>
            </DialogHeader>
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="The AI gave me outdated information about React 18..."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
              <Button onClick={() => { setFeedbackOpen(false); setFeedbackText("") }}>Submit Feedback</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
