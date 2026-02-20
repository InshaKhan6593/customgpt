"use client"

import { useState, useRef, useEffect } from "react"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatHeader } from "@/components/chat/chat-header"
import { ChatMessages } from "@/components/chat/chat-messages"
import { ChatInput } from "@/components/chat/chat-input"
import { FeedbackDialog } from "@/components/chat/feedback-dialog"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolCall?: string
  rating?: "up" | "down" | null
}

const MOCK_HISTORY = [
  { id: "1", title: "Help with Next.js code..." },
  { id: "2", title: "Explain quantum computing" },
  { id: "3", title: "Marketing strategy ideas" },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isGenerating])

  const handleSend = async (content: string) => {
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content, rating: null }
    setMessages((prev) => [...prev, userMsg])
    setIsGenerating(true)

    // Simulate tool call
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Simulate response
    await new Promise((resolve) => setTimeout(resolve, 1200))

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `Here's a helpful response to your query about "${content.slice(0, 50)}". This is a **simulated** response that demonstrates markdown support including:\n\n- **Bold text** and *italic text*\n- Bullet point lists\n- \`inline code\` blocks\n\n\`\`\`javascript\nconst greeting = "Hello, world!";\nconsole.log(greeting);\n\`\`\`\n\nHope that helps!`,
      rating: null,
    }

    setMessages((prev) => [...prev, assistantMsg])
    setIsGenerating(false)
  }

  const handleRate = (messageId: string, rating: "up" | "down") => {
    if (rating === "down") {
      setFeedbackMessageId(messageId)
    }
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, rating } : msg))
    )
  }

  const handleDeleteChat = (chatId: string) => {
    // In production, this would delete the chat from the database
    console.log("Delete chat:", chatId)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        history={MOCK_HISTORY}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onDeleteChat={handleDeleteChat}
      />

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        <ChatHeader
          webletName="Codebot 3000"
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <ChatMessages
            messages={messages}
            isGenerating={isGenerating}
            onRate={handleRate}
          />
        </div>

        <ChatInput onSend={handleSend} disabled={isGenerating} />
      </div>

      <FeedbackDialog
        isOpen={!!feedbackMessageId}
        onClose={() => setFeedbackMessageId(null)}
        onSubmit={(feedback) => {
          console.log("Feedback for message:", feedbackMessageId, feedback)
          setFeedbackMessageId(null)
        }}
      />
    </div>
  )
}
