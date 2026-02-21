"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Save,
  Play,
  Plus,
  Trash2,
  Loader2,
  GripVertical,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
  Crown,
} from "lucide-react"

const AVAILABLE_WEBLETS = [
  { id: "codebot", name: "Codebot 3000" },
  { id: "marketing", name: "Marketing Wizard" },
  { id: "analyst", name: "Data Analyst Pro" },
  { id: "essay", name: "Essay Helper" },
  { id: "research", name: "Research Buddy" },
  { id: "legal", name: "Legal Assistant" },
  { id: "finance", name: "Finance Advisor" },
  { id: "health", name: "Health Coach" },
]

type Step = {
  id: string
  webletId: string
  inputMapping: "original" | "previous"
  humanApproval: boolean
}

type RunStatus = "idle" | "running" | "completed"

type StepRunState = {
  status: "pending" | "running" | "completed"
  output?: string
}

export default function FlowBuilderPage() {
  const [flowName, setFlowName] = useState("Untitled Flow")
  const [executionMode, setExecutionMode] = useState<"sequential" | "hybrid">("sequential")
  const [steps, setSteps] = useState<Step[]>([
    { id: "step-1", webletId: "research", inputMapping: "original", humanApproval: false },
    { id: "step-2", webletId: "essay", inputMapping: "previous", humanApproval: false },
  ])
  const [isSaving, setIsSaving] = useState(false)
  const [runStatus, setRunStatus] = useState<RunStatus>("idle")
  const [showRunModal, setShowRunModal] = useState(false)
  const [stepRunStates, setStepRunStates] = useState<StepRunState[]>([])

  // Hybrid mode
  const [masterWeblet, setMasterWeblet] = useState("codebot")
  const [subWeblets, setSubWeblets] = useState<string[]>(["research", "analyst"])

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1200)
  }

  const addStep = () => {
    const newStep: Step = {
      id: `step-${Date.now()}`,
      webletId: "",
      inputMapping: steps.length === 0 ? "original" : "previous",
      humanApproval: false,
    }
    setSteps((prev) => [...prev, newStep])
  }

  const removeStep = (id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  const updateStep = (id: string, updates: Partial<Step>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    )
  }

  const getWebletName = (id: string) => AVAILABLE_WEBLETS.find((w) => w.id === id)?.name || "Select agent"

  const handleRun = () => {
    setShowRunModal(true)
    setRunStatus("running")

    const initialStates: StepRunState[] = steps.map(() => ({ status: "pending" }))
    setStepRunStates(initialStates)

    // Simulate sequential execution
    steps.forEach((_, index) => {
      setTimeout(() => {
        setStepRunStates((prev) => {
          const next = [...prev]
          if (index > 0 && next[index - 1]) {
            next[index - 1] = { status: "completed", output: `Output from Step ${index}` }
          }
          next[index] = { status: "running" }
          return next
        })
      }, index * 2000)
    })

    // Complete the last step
    setTimeout(() => {
      setStepRunStates((prev) => {
        const next = [...prev]
        next[steps.length - 1] = { status: "completed", output: `Final output from Step ${steps.length}` }
        return next
      })
      setRunStatus("completed")
    }, steps.length * 2000)
  }

  const toggleSubWeblet = (id: string) => {
    setSubWeblets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Link href="/flows">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Back to flows">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            className="h-8 w-56 border-transparent bg-transparent font-semibold hover:border-border focus:border-border"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Save
          </Button>
          <Button size="sm" onClick={handleRun} disabled={runStatus === "running"} className="gap-1.5">
            {runStatus === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run Flow
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {/* Execution Mode Toggle */}
        <Card className="mb-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Execution Mode</CardTitle>
            <CardDescription>Choose how agents pass data to each other.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={executionMode}
              onValueChange={(v) => setExecutionMode(v as "sequential" | "hybrid")}
              className="flex gap-4"
            >
              <label
                className={`flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  executionMode === "sequential" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem value="sequential" className="mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Sequential</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{"A -> B -> C: Each agent passes output to the next."}</p>
                </div>
              </label>
              <label
                className={`flex flex-1 cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                  executionMode === "hybrid" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem value="hybrid" className="mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Hybrid</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Master agent delegates tasks to sub-agents.</p>
                </div>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Sequential Mode */}
        {executionMode === "sequential" && (
          <div className="flex flex-col gap-0">
            {steps.map((step, index) => (
              <div key={step.id}>
                <Card className="relative">
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="secondary" className="text-xs">Step {index + 1}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeStep(step.id)}
                        aria-label={`Remove step ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Agent</Label>
                      <Select
                        value={step.webletId}
                        onValueChange={(v) => updateStep(step.id, { webletId: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a Weblet" />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_WEBLETS.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Input Mapping</Label>
                      <Select
                        value={step.inputMapping}
                        onValueChange={(v) => updateStep(step.id, { inputMapping: v as "original" | "previous" })}
                        disabled={index === 0}
                      >
                        <SelectTrigger>
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
                        <p className="text-xs text-muted-foreground">The first step always uses the original prompt.</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <Label className="text-sm">Pause for my approval</Label>
                        <p className="text-xs text-muted-foreground">Human-in-the-loop before this step runs.</p>
                      </div>
                      <Switch
                        checked={step.humanApproval}
                        onCheckedChange={(v) => updateStep(step.id, { humanApproval: v })}
                      />
                    </div>
                  </CardContent>
                </Card>

                {index < steps.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowRight className="h-5 w-5 rotate-90 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              className="mt-4 gap-2 border-dashed"
              onClick={addStep}
            >
              <Plus className="h-4 w-4" />
              Add Step
            </Button>
          </div>
        )}

        {/* Hybrid Mode */}
        {executionMode === "hybrid" && (
          <div className="flex flex-col gap-6">
            <Card className="border-2 border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Master Weblet</CardTitle>
                </div>
                <CardDescription>The orchestrator that delegates tasks to sub-agents.</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={masterWeblet} onValueChange={setMasterWeblet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select master agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_WEBLETS.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Available Sub-Weblets</CardTitle>
                <CardDescription>The master agent can choose to delegate to any of these.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  {AVAILABLE_WEBLETS.filter((w) => w.id !== masterWeblet).map((w) => (
                    <label
                      key={w.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                        subWeblets.includes(w.id) ? "border-primary/30 bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={subWeblets.includes(w.id)}
                          onCheckedChange={() => toggleSubWeblet(w.id)}
                        />
                        <span className="text-sm font-medium text-foreground">{w.name}</span>
                      </div>
                      {subWeblets.includes(w.id) && (
                        <Badge variant="secondary" className="text-[10px]">Active</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Run Flow Modal */}
      <Dialog open={showRunModal} onOpenChange={setShowRunModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Running: {flowName}</DialogTitle>
            <DialogDescription>
              {runStatus === "completed"
                ? "Flow execution completed successfully."
                : "Executing your multi-agent workflow..."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-0 py-4">
            {steps.map((step, index) => {
              const state = stepRunStates[index]
              return (
                <div key={step.id}>
                  <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card">
                      {state?.status === "completed" ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : state?.status === "running" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Step {index + 1}: {getWebletName(step.webletId)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {state?.status === "completed"
                          ? "Completed"
                          : state?.status === "running"
                          ? "Processing..."
                          : "Pending"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        state?.status === "completed" ? "default" :
                        state?.status === "running" ? "secondary" :
                        "outline"
                      }
                      className="text-[10px]"
                    >
                      {state?.status === "completed" ? "Done" : state?.status === "running" ? "Running" : "Queued"}
                    </Badge>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex justify-center py-1">
                      <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {runStatus === "completed" && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-success" />
                <p className="text-sm font-medium text-foreground">Flow completed successfully</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                All {steps.length} steps executed without errors. Results are ready.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
