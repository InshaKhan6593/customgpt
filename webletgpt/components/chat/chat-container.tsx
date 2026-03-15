"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ChatHeader } from "./chat-header"
import { MessageList } from "./message-list"
import { InputBar } from "./input-bar"
import { RatingDialog } from "./rating-dialog"
import { MAX_MESSAGES_PER_SESSION } from "@/lib/constants"
import { AlertCircle, MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatContainerProps {
  weblet: {
    id: string
    name: string
    iconUrl: string | null
  }
  session?: {
    id: string
  } | null
  conversationStarters?: string[]
  initialMessages?: UIMessage[]
  onNewChat?: () => void
}

export function ChatContainer({
  weblet,
  session,
  conversationStarters = [],
  initialMessages = [],
  onNewChat,
}: ChatContainerProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Feedback state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState("")
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  const [input, setInput] = useState("")

  const { messages, sendMessage, status } =
    useChat({
      id: session?.id,
      transport: new DefaultChatTransport({
        api: "/api/chat",
        body: {
          webletId: weblet.id,
          sessionId: session?.id,
        },
      }),
      messages: initialMessages,
      onFinish: () => {
        // If this was a new chat, the server creates a session and returns it in a header
        // For now, simpler: we just reload router if it's the first message so the URL updates
        if (!session?.id && messages.length === 0) {
          router.refresh()
        }
      }
    })

    const isLoading = status === "submitted" || status === "streaming"

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput("")
  }

  // Auto-scroll to bottom when messages change — only if user is near the bottom
  const isNearBottomRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => {
      const threshold = 100
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    }
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (isNearBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages])

  const handleStarterClick = (starter: string) => {
    sendMessage({ text: starter })
  }

  const handleRating = async (messageId: string, rating: "UP" | "DOWN") => {
    if (rating === "UP") {
      try {
        await fetch("/api/chat/sessions/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session?.id, score: 5 }),
        })
        toast.success("Thanks for the feedback!")
      } catch (e) {
        toast.error("Failed to submit rating")
      }
    } else {
      setSelectedMessageId(messageId)
      setFeedbackText("")
      setFeedbackModalOpen(true)
    }
  }

  const submitFeedback = async () => {
    if (!selectedMessageId) return
    setIsSubmittingFeedback(true)
    try {
      await fetch("/api/chat/sessions/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session?.id,
          score: 1,
          comment: feedbackText,
        }),
      })
      toast.success("Thanks for the detailed feedback!")
      setFeedbackModalOpen(false)
    } catch (e) {
      toast.error("Failed to submit feedback")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  // On-demand MCP OAuth: after user connects via OAuth popup or PAT input,
  // re-send the last user message so the LLM retries the tool call with the new token.
  const handleMCPAuthComplete = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")
    if (lastUserMsg) {
      const text = lastUserMsg.parts
        ?.filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n")
      if (text) {
        sendMessage({ text })
      }
    }
  }, [messages, sendMessage])

  // Listen for OAuth popup completion via postMessage
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === "mcp-oauth-complete" && event.data?.success) {
        handleMCPAuthComplete()
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [handleMCPAuthComplete])

  const isAtMessageLimit = messages.length >= MAX_MESSAGES_PER_SESSION

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <ChatHeader weblet={weblet} />

      <MessageList
        messages={messages}
        weblet={weblet}
        conversationStarters={conversationStarters}
        isLoading={isLoading}
        onStarterClick={handleStarterClick}
        onRateMessage={handleRating}
        onMCPAuthComplete={handleMCPAuthComplete}
        scrollRef={scrollRef}
      />

      {isAtMessageLimit ? (
        <div className="border-t bg-muted/50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>This conversation has reached the message limit.</span>
          </div>
          {onNewChat && (
            <Button size="sm" variant="default" onClick={onNewChat} className="shrink-0">
              <MessageSquarePlus className="h-4 w-4 mr-1.5" />
              New Chat
            </Button>
          )}
        </div>
      ) : (
        <InputBar
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
        />
      )}

      <RatingDialog
        isOpen={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        feedbackText={feedbackText}
        onFeedbackChange={setFeedbackText}
        onSubmit={submitFeedback}
        isSubmitting={isSubmittingFeedback}
      />
    </div>
  )
}
