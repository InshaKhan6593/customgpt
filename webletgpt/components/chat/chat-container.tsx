"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, UIMessage } from "ai"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ChatHeader } from "./chat-header"
import MessageList from "./message-list"
import { InputBar } from "./input-bar"
import { RatingDialog } from "./rating-dialog"
import { MAX_MESSAGES_PER_SESSION } from "@/lib/constants"
import { AlertCircle, MessageSquarePlus, RotateCcw } from "lucide-react"
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
  /** Called when a new session is created from the first message (ChatGPT-style). */
  onSessionCreated?: (sessionId: string) => void
  /** Hide the built-in ChatHeader (use when the parent already renders one) */
  hideHeader?: boolean
}

export function ChatContainer({
  weblet,
  session,
  conversationStarters = [],
  initialMessages = [],
  onNewChat,
  onSessionCreated,
  hideHeader = false,
}: ChatContainerProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Track the real session ID — starts from prop, updated after pre-creation
  const [sessionId, setSessionId] = useState<string | undefined>(session?.id)

  const chatId = useId()
  const sessionIdRef = useRef<string | undefined>(session?.id)

  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Feedback state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [feedbackText, setFeedbackText] = useState("")
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  const [input, setInput] = useState("")

  // Ref for pending message — queued while session is being created
  const pendingMessageRef = useRef<string | null>(null)

  const transport = useMemo(
    () => new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          id,
          messages,
          webletId: weblet.id,
          sessionId: sessionIdRef.current,
        },
      }),
    }),
    [weblet.id]
  )

  const { messages, sendMessage, status, stop, regenerate, clearError } =
    useChat({
      id: chatId,
      transport,
      messages: initialMessages,
      experimental_throttle: 50,
      onError: (error) => {
        const raw = error.message || ""
        if (raw.includes("developer_credits_exhausted")) {
          toast.error("This weblet is temporarily unavailable — developer credits exhausted.", { duration: 6000 })
        } else if (raw.includes("user_credits_exceeded")) {
          toast.error("You've used all your credits for this period. Upgrade your plan to continue.", { duration: 6000 })
        } else if (raw.includes("PAYMENT_REQUIRED")) {
          toast.error("A subscription is required to use this weblet.", { duration: 5000 })
        } else if (raw.includes("model_unavailable:")) {
          const modelName = raw.split("model_unavailable:")[1]?.split("/").pop() || "this model"
          toast.error(`The AI model "${modelName}" is temporarily unavailable. Try again in a moment.`, { duration: 6000 })
        } else if (raw.includes("model_rate_limited:")) {
          const modelName = raw.split("model_rate_limited:")[1]?.split("/").pop() || "this model"
          toast.error(`The AI model "${modelName}" is rate-limited. Please wait a moment and try again.`, { duration: 6000 })
        } else {
          toast.error("Something went wrong. Please try again.")
        }
      },
    })

  const isLoading = status === "submitted" || status === "streaming"

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  // Send pending message after session is created.
  useEffect(() => {
    if (pendingMessageRef.current && sessionId) {
      const text = pendingMessageRef.current
      pendingMessageRef.current = null
      sendMessage({ text })
    }
  }, [sessionId, sendMessage])

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isLoading) return

    const text = input
    setInput("")

    // Pre-create session for new chats (ChatGPT-style)
    if (!sessionId) {
      pendingMessageRef.current = text
      try {
        const res = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webletId: weblet.id }),
        })
        if (!res.ok) throw new Error("Failed to create session")
        const { id: newId } = await res.json()
        setSessionId(newId)
        onSessionCreated?.(newId)
        router.replace(`/chat/${weblet.id}/${newId}`)
        router.refresh()
      } catch {
        toast.error("Failed to start chat. Please try again.")
        pendingMessageRef.current = null
        setInput(text)
      }
      return
    }

    sendMessage({ text })
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

  const scrollRafRef = useRef<number | null>(null)
  useEffect(() => {
    if (!isNearBottomRef.current || !scrollRef.current) return
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: isLoading ? "instant" : "smooth",
      })
    })
  }, [messages, isLoading])

  const handleStarterClick = (starter: string) => {
    // Use same flow as handleSubmit — pre-create session if needed
    setInput("")
    if (!sessionId) {
      pendingMessageRef.current = starter
      fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: weblet.id }),
      })
        .then((res) => {
          if (!res.ok) throw new Error()
          return res.json()
        })
        .then(({ id: newId }) => {
          setSessionId(newId)
          onSessionCreated?.(newId)
          router.replace(`/chat/${weblet.id}/${newId}`)
          router.refresh()
        })
        .catch(() => {
          toast.error("Failed to start chat")
          pendingMessageRef.current = null
        })
      return
    }
    sendMessage({ text: starter })
  }

  const handleRating = async (messageId: string, rating: "UP" | "DOWN") => {
    if (rating === "UP") {
      try {
        await fetch("/api/chat/sessions/rate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, score: 5 }),
        })
        toast.success("Thanks for the feedback!")
      } catch {
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
        body: JSON.stringify({ sessionId, score: 1, comment: feedbackText }),
      })
      toast.success("Thanks for the detailed feedback!")
      setFeedbackModalOpen(false)
    } catch {
      toast.error("Failed to submit feedback")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  // MCP OAuth: re-send the last user message after auth completes
  const handleMCPAuthComplete = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user")
    if (lastUserMsg) {
      const text = lastUserMsg.parts
        ?.filter((p: any) => p.type === "text")
        .map((p: any) => p.text)
        .join("\n")
      if (text) sendMessage({ text })
    }
  }, [messages, sendMessage])

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
      {!hideHeader && <ChatHeader weblet={weblet} />}

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

      {status === "error" && (
        <div className="border-t bg-destructive/5 px-4 py-2.5">
          <div className="max-w-[44rem] mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span>Failed to get a response.</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => clearError()}>
                Dismiss
              </Button>
              <Button size="sm" variant="default" onClick={() => regenerate()}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAtMessageLimit ? (
        <div className="border-t bg-muted/50 px-4 py-3">
        <div className="max-w-[44rem] mx-auto flex items-center justify-between gap-3">
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
        </div>
      ) : (
        <InputBar
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
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
