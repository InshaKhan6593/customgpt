"use client"

import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Send, Square } from "lucide-react"

interface InputBarProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e?: React.FormEvent | React.MouseEvent) => void
  isLoading: boolean
  onStop?: () => void
}

export function InputBar({ input, handleInputChange, handleSubmit, isLoading, onStop }: InputBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        handleSubmit(e)
      }
    }
  }

  return (
    <div className="shrink-0 w-full bg-gradient-to-t from-background via-background to-transparent pt-3 pb-3 px-4 sticky bottom-0">
      <div className="max-w-[44rem] mx-auto relative flex items-end gap-1 bg-muted/50 border border-border/50 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-ring/30">
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="min-h-[36px] max-h-28 resize-none border-0 focus-visible:ring-0 shadow-none px-1 py-1 text-sm bg-transparent"
          rows={1}
        />

        {isLoading && onStop ? (
          <Button
            onClick={onStop}
            size="icon"
            variant="outline"
            className="shrink-0 h-7 w-7 rounded-full mb-0.5"
            title="Stop generating"
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 h-7 w-7 rounded-full mb-0.5"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  )
}
