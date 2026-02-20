"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, GripVertical, ArrowDown } from "lucide-react"
import type { FlowStep } from "@/app/flows/builder/[id]/page"

const AVAILABLE_AGENTS = [
  "ResearchBot",
  "WriterBot",
  "CodeAnalyzer",
  "Codebot 3000",
  "TestWriter",
  "CopywriterAI",
  "SEO Optimizer",
  "DataCruncher",
]

interface FlowStepListProps {
  steps: FlowStep[]
  onUpdate: (id: string, updates: Partial<FlowStep>) => void
  onRemove: (id: string) => void
  onAdd: () => void
}

export function FlowStepList({ steps, onUpdate, onRemove, onAdd }: FlowStepListProps) {
  return (
    <div className="flex flex-col items-center gap-0">
      {steps.map((step, index) => (
        <div key={step.id} className="w-full">
          {index > 0 && (
            <div className="flex justify-center py-2">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <Card>
            <CardContent className="flex items-start gap-3 pt-5">
              <div className="mt-1 flex-shrink-0">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="flex flex-1 flex-col gap-4">
                {/* Step Header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Step {index + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemove(step.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Remove step</span>
                  </Button>
                </div>

                {/* Agent Selection */}
                <div>
                  <Label className="text-foreground">Agent</Label>
                  <Select
                    value={step.agentName}
                    onValueChange={(v) => onUpdate(step.id, { agentName: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select a Weblet..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_AGENTS.map((agent) => (
                        <SelectItem key={agent} value={agent}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Input Mapping */}
                <div>
                  <Label className="text-foreground">Input Source</Label>
                  <Select
                    value={step.inputSource}
                    onValueChange={(v) =>
                      onUpdate(step.id, { inputSource: v as "original" | "previous" })
                    }
                    disabled={index === 0}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">{"User's Original Prompt"}</SelectItem>
                      {index > 0 && (
                        <SelectItem value="previous">Output of Previous Step</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {index === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {"The first step always uses the user's original prompt"}
                    </p>
                  )}
                </div>

                {/* Human-in-the-Loop */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label htmlFor={`hitl-${step.id}`} className="text-foreground">
                      Pause for my approval
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Wait for your confirmation before running this step
                    </p>
                  </div>
                  <Switch
                    id={`hitl-${step.id}`}
                    checked={step.humanInTheLoop}
                    onCheckedChange={(v) => onUpdate(step.id, { humanInTheLoop: v })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}

      <Button variant="outline" className="mt-4" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add Step
      </Button>
    </div>
  )
}
