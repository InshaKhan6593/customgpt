"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, CheckCircle2, Circle, ArrowRight, Send } from "lucide-react"
import type { FlowStep } from "@/app/flows/builder/[id]/page"

interface FlowRunModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: FlowStep[]
}

type StepStatus = "pending" | "running" | "paused" | "completed"

export function FlowRunModal({ open, onOpenChange, steps }: FlowRunModalProps) {
  const [prompt, setPrompt] = useState("")
  const [started, setStarted] = useState(false)
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([])
  const [outputs, setOutputs] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setPrompt("")
      setStarted(false)
      setStepStatuses(steps.map(() => "pending"))
      setOutputs([])
    }
  }, [open, steps])

  const runNextStep = useCallback(
    (index: number) => {
      if (index >= steps.length) return

      setStepStatuses((prev) => {
        const next = [...prev]
        next[index] = "running"
        return next
      })

      // Simulate AI processing
      setTimeout(() => {
        const step = steps[index]
        if (step.humanInTheLoop) {
          setStepStatuses((prev) => {
            const next = [...prev]
            next[index] = "paused"
            return next
          })
        } else {
          setStepStatuses((prev) => {
            const next = [...prev]
            next[index] = "completed"
            return next
          })
          setOutputs((prev) => [
            ...prev,
            `[${step.agentName}] Generated output for step ${index + 1}...`,
          ])
          runNextStep(index + 1)
        }
      }, 2000)
    },
    [steps]
  )

  const handleStart = () => {
    if (!prompt.trim()) return
    setStarted(true)
    runNextStep(0)
  }

  const handleApprove = (index: number) => {
    setStepStatuses((prev) => {
      const next = [...prev]
      next[index] = "completed"
      return next
    })
    setOutputs((prev) => [
      ...prev,
      `[${steps[index].agentName}] Approved and completed step ${index + 1}.`,
    ])
    runNextStep(index + 1)
  }

  const allDone = stepStatuses.every((s) => s === "completed")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Run Flow</DialogTitle>
        </DialogHeader>

        {/* Progress Tracker */}
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          {steps.map((step, i) => {
            const status = stepStatuses[i]
            return (
              <span key={step.id} className="flex items-center gap-1 text-xs">
                {status === "completed" && (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                )}
                {status === "running" && (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                )}
                {status === "paused" && (
                  <Circle className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-500" />
                )}
                {status === "pending" && (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={
                    status === "running" || status === "paused"
                      ? "font-medium text-foreground"
                      : status === "completed"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }
                >
                  {step.agentName || `Step ${i + 1}`}
                </span>
                {i < steps.length - 1 && (
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                )}
              </span>
            )
          })}
        </div>

        {/* Output Area */}
        {started && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
            {outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Processing...</p>
            ) : (
              outputs.map((out, i) => (
                <p key={i} className="mb-1 text-sm text-foreground">
                  {out}
                </p>
              ))
            )}

            {/* Human-in-the-loop approval */}
            {stepStatuses.map(
              (status, i) =>
                status === "paused" && (
                  <div key={i} className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <p className="flex-1 text-sm text-foreground">
                      <strong>{steps[i].agentName}</strong> is waiting for your approval.
                    </p>
                    <Button size="sm" onClick={() => handleApprove(i)}>
                      Approve
                    </Button>
                  </div>
                )
            )}

            {allDone && (
              <p className="mt-3 border-t border-border pt-3 text-sm font-medium text-primary">
                Flow completed successfully.
              </p>
            )}
          </div>
        )}

        {/* Prompt Input */}
        {!started && (
          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt to start the flow..."
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
            />
            <Button onClick={handleStart} disabled={!prompt.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Start</span>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
