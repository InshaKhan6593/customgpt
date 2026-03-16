"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { MessageCircleQuestion, Send, Check } from "lucide-react"

interface UserInputCardProps {
  toolCallId: string
  question: string
  options?: string[]
  placeholder?: string
  allowFreeText?: boolean
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  output?: string
  addToolOutput: (args: { tool: string; toolCallId: string; output: string }) => void
}

export function UserInputCard({
  toolCallId,
  question,
  options = [],
  placeholder = "Type your response...",
  allowFreeText = true,
  state,
  output,
  addToolOutput,
}: UserInputCardProps) {
  const [selectedOption, setSelectedOption] = React.useState<string | null>(null)
  const [freeText, setFreeText] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const isCompleted = state === "output-available" || state === "output-error" || isSubmitting
  const showSkeleton = state === "input-streaming"

  const handleSubmit = React.useCallback(() => {
    if (isCompleted || showSkeleton) return
    const finalOutput = selectedOption || freeText.trim()
    if (!finalOutput) return

    setIsSubmitting(true)
    addToolOutput({
      tool: "requestUserInput",
      toolCallId,
      output: finalOutput,
    })
  }, [isCompleted, showSkeleton, selectedOption, freeText, addToolOutput, toolCallId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (showSkeleton) {
    return (
      <Card className="my-2 border border-border/50 bg-muted/30 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CardContent className="p-4 flex gap-3">
          <div className="mt-0.5">
            <MessageCircleQuestion className="w-5 h-5 text-muted-foreground animate-pulse" />
          </div>
          <div className="space-y-3 flex-1">
            <div className="h-5 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isCompleted) {
    return (
      <Card className="my-2 border-border/30 bg-muted/20 opacity-80 w-full max-w-2xl transition-all duration-300">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="mt-0.5 text-primary">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-foreground font-semibold">{question}</p>
              {state === "output-error" ? (
                <div className="mt-2 text-sm text-destructive font-medium">Error submitting response.</div>
              ) : (
                <div className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary border border-primary/20">
                  {output || selectedOption || freeText}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasInput = !!selectedOption || freeText.trim().length > 0

  return (
    <Card className="my-2 border border-border/50 bg-muted/30 w-full max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex gap-3 items-start">
          <div className="mt-0.5 text-primary">
            <MessageCircleQuestion className="w-5 h-5" />
          </div>
          <h3 className="text-foreground font-semibold text-base leading-snug">
            {question}
          </h3>
        </div>

        <div className="flex flex-col gap-3 pl-8">
          {options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {options.map((opt) => {
                const isSelected = selectedOption === opt
                return (
                  <Button
                    key={opt}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "rounded-full transition-all text-sm h-9 px-4",
                      isSelected
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border-border hover:bg-accent hover:text-accent-foreground"
                    )}
                    onClick={() => {
                      setSelectedOption(isSelected ? null : opt)
                      if (!isSelected) setFreeText("")
                    }}
                  >
                    {opt}
                  </Button>
                )
              })}
            </div>
          )}

          {allowFreeText && (
            <div className="relative">
              <Textarea
                placeholder={placeholder}
                value={freeText}
                onChange={(e) => {
                  setFreeText(e.target.value)
                  if (e.target.value.trim().length > 0) {
                    setSelectedOption(null)
                  }
                }}
                onKeyDown={handleKeyDown}
                className="min-h-[80px] w-full resize-none pr-12 bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
              />
              <Button
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8 rounded-md transition-all"
                disabled={!hasInput}
                onClick={handleSubmit}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Submit</span>
              </Button>
            </div>
          )}

          {!allowFreeText && (
            <div className="flex justify-end mt-2">
              <Button
                disabled={!hasInput}
                onClick={handleSubmit}
                className="rounded-full px-6 transition-all"
              >
                Submit <Send className="ml-2 w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
