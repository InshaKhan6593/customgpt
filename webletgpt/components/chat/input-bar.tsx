"use client"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Paperclip, Send } from "lucide-react"

interface InputBarProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e?: React.FormEvent | React.MouseEvent) => void
  isLoading: boolean
}

export function InputBar({ input, handleInputChange, handleSubmit, isLoading }: InputBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        handleSubmit(e)
      }
    }
  }

  return (
    <div className="shrink-0 w-full bg-gradient-to-t from-background via-background to-transparent pt-6 pb-4 px-4 sticky bottom-0">
      <div className="max-w-3xl mx-auto relative flex items-end gap-2 bg-background border rounded-2xl p-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground" disabled>
          <Paperclip className="h-5 w-5" />
        </Button>
        
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message the assistant..."
          className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 shadow-none p-3 pb-2 text-sm"
          rows={1}
        />
        
        <Button 
          onClick={handleSubmit} 
          disabled={!input.trim() || isLoading}
          size="icon" 
          className="shrink-0 h-9 w-9 rounded-xl mb-0.5"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-3">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  )
}
