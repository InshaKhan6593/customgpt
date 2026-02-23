"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, UIMessage } from "ai"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ChatHeader } from "./chat-header"
import { MessageList } from "./message-list"
import { InputBar } from "./input-bar"
import { RatingDialog } from "./rating-dialog"

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
}

export function ChatContainer({
  weblet,
  session,
  conversationStarters = [],
  initialMessages = []
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleStarterClick = (starter: string) => {
    sendMessage({ text: starter })
  }

  const handleRating = async (messageId: string, rating: "UP" | "DOWN") => {
    if (rating === "UP") {
      try {
        await fetch("/api/chat/feedback", {
          method: "POST",
          body: JSON.stringify({ webletId: weblet.id, sessionId: session?.id, messageId, rating })
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
      await fetch("/api/chat/feedback", {
        method: "POST",
        body: JSON.stringify({ 
          webletId: weblet.id, 
          sessionId: session?.id, 
          messageId: selectedMessageId, 
          rating: "DOWN", 
          feedbackText 
        })
      })
      toast.success("Thanks for the detailed feedback!")
      setFeedbackModalOpen(false)
    } catch (e) {
      toast.error("Failed to submit feedback")
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      <ChatHeader weblet={weblet} />

      <MessageList 
        messages={messages}
        weblet={weblet}
        conversationStarters={conversationStarters}
        isLoading={isLoading}
        onStarterClick={handleStarterClick}
        onRateMessage={handleRating}
        scrollRef={scrollRef}
      />

      <InputBar 
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
      />

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
