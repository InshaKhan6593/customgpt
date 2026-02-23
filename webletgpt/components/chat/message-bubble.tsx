"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Copy, ThumbsDown, ThumbsUp } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { UIMessage } from "ai"
import { toast } from "sonner"

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

  return (
    <div
      className={`flex gap-4 group ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      {message.role === "assistant" && (
        <Avatar className="h-8 w-8 shrink-0 mt-1">
          <AvatarImage src={weblet.iconUrl || undefined} />
          <AvatarFallback>{weblet.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}
      
      <div className="flex flex-col gap-2 max-w-[85%]">
        {/* Tool calls would be rendered here */}
        
        {/* Text Content */}
        {textContent && (
          <div
            className={`rounded-2xl px-5 py-3 ${
              message.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground border shadow-sm"
            }`}
          >
            <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:p-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {textContent}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {message.role === "user" && (
        <Avatar className="h-8 w-8 shrink-0 mt-1">
          <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
        </Avatar>
      )}
      
      {/* Message Actions (Invisible until hover, only for Assistant) */}
      {message.role === "assistant" && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-end pb-1 pr-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={() => handleCopy(textContent)}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={() => onRateMessage(message.id, "UP")}>
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-muted" onClick={() => onRateMessage(message.id, "DOWN")}>
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
