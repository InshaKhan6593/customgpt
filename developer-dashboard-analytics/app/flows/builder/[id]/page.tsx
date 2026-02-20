"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { FlowStepList } from "@/components/flows/flow-step-list"
import { FlowRunModal } from "@/components/flows/flow-run-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Save, Play } from "lucide-react"

export interface FlowStep {
  id: string
  agentName: string
  inputSource: "original" | "previous"
  humanInTheLoop: boolean
}

export default function FlowBuilderPage() {
  const [flowName, setFlowName] = useState("Research to Article")
  const [steps, setSteps] = useState<FlowStep[]>([
    { id: "s1", agentName: "ResearchBot", inputSource: "original", humanInTheLoop: false },
    { id: "s2", agentName: "WriterBot", inputSource: "previous", humanInTheLoop: true },
  ])
  const [showRunModal, setShowRunModal] = useState(false)

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        id: `s${Date.now()}`,
        agentName: "",
        inputSource: prev.length === 0 ? "original" : "previous",
        humanInTheLoop: false,
      },
    ])
  }

  const updateStep = (id: string, updates: Partial<FlowStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/flows"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Flows
        </Link>

        {/* Top Bar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="max-w-sm text-lg font-semibold"
            placeholder="Flow Name"
          />
          <div className="flex gap-2">
            <Button variant="outline">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button onClick={() => setShowRunModal(true)} disabled={steps.length === 0}>
              <Play className="mr-2 h-4 w-4" />
              Run Flow
            </Button>
          </div>
        </div>

        {/* Step List */}
        <FlowStepList
          steps={steps}
          onUpdate={updateStep}
          onRemove={removeStep}
          onAdd={addStep}
        />
      </div>

      <FlowRunModal
        open={showRunModal}
        onOpenChange={setShowRunModal}
        steps={steps}
      />
    </div>
  )
}
