"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { RSILGovernance, DEFAULT_GOVERNANCE, DEFAULT_EVALUATOR_CONFIG } from "@/lib/rsil/governance"
import { EvaluatorConfigSection } from "./evaluator-config"

interface GovernancePanelProps {
  webletId: string
}

export function GovernancePanel({ webletId }: GovernancePanelProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedGovernance, setSavedGovernance] = useState<RSILGovernance | null>(null)
  const [formGovernance, setFormGovernance] = useState<RSILGovernance>(DEFAULT_GOVERNANCE)

  useEffect(() => {
    async function fetchGovernance() {
      try {
        const res = await fetch(`/api/rsil/governance?webletId=${webletId}`)
        if (!res.ok) throw new Error("Failed to fetch governance settings")
        const data = await res.json()
        const gov = data.governance || DEFAULT_GOVERNANCE
        setSavedGovernance(gov)
        setFormGovernance(gov)
      } catch (error) {
        toast.error("Failed to load governance settings")
      } finally {
        setLoading(false)
      }
    }
    fetchGovernance()
  }, [webletId])

  const isDirty = JSON.stringify(formGovernance) !== JSON.stringify(savedGovernance)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/rsil/governance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId, governance: formGovernance }),
      })
      if (!res.ok) throw new Error("Failed to save governance")
      setSavedGovernance(formGovernance)
      toast.success("Governance settings saved")
    } catch (error) {
      toast.error("Failed to save governance")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setFormGovernance(DEFAULT_GOVERNANCE)
  }

  function getPerformanceColor(value: number) {
    if (value > 0.6) return "text-green-500"
    if (value >= 0.4) return "text-yellow-500"
    return "text-red-500"
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Governance Settings</CardTitle>
              <CardDescription>Configure rules and safety guardrails for RSIL automation</CardDescription>
            </div>
            <Badge variant="secondary">
              {!formGovernance.enabled
                ? "Manual"
                : `Automated — ${formGovernance.optimizationFrequency === "daily" ? "Daily" : "Weekly"}`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <EvaluatorConfigSection
            webletId={webletId}
            value={formGovernance.evaluatorConfig ?? DEFAULT_EVALUATOR_CONFIG}
            onChange={(config) => setFormGovernance({ ...formGovernance, evaluatorConfig: config })}
          />

          <Card className="bg-card/50 p-4 space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Automation</h3>
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Enable Automation</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Run optimization automatically on schedule</p>
              </div>
              <Switch
                checked={formGovernance.enabled}
                onCheckedChange={(v: boolean) => setFormGovernance({ ...formGovernance, enabled: v })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Optimization Frequency</Label>
                <p className="text-xs text-muted-foreground mt-0.5">How often to generate and test new variants</p>
              </div>
              <Select
                disabled={!formGovernance.enabled}
                value={formGovernance.optimizationFrequency}
                onValueChange={(v: 'daily' | 'weekly' | 'manual') => setFormGovernance({ ...formGovernance, optimizationFrequency: v })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Require Approval</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Require manual review before starting A/B tests</p>
              </div>
              <Switch
                checked={formGovernance.requireApproval}
                onCheckedChange={(v: boolean) => setFormGovernance({ ...formGovernance, requireApproval: v })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Cooldown Hours</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Hours to wait between optimization runs</p>
              </div>
              <Input
                type="number"
                min={1}
                className="w-[120px]"
                value={formGovernance.cooldownHours}
                onChange={(e) => setFormGovernance({ ...formGovernance, cooldownHours: parseInt(e.target.value) || 0 })}
              />
            </div>
          </Card>

          <Card className="bg-card/50 p-4 space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">A/B Testing</h3>
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">
                  Traffic Split <span className="font-medium ml-2">{formGovernance.abTestTrafficPct}%</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Percentage of traffic sent to candidate versions</p>
              </div>
              <Slider
                className="w-[200px]"
                min={1}
                max={99}
                step={1}
                value={[formGovernance.abTestTrafficPct]}
                onValueChange={([v]: number[]) => setFormGovernance({ ...formGovernance, abTestTrafficPct: v })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Min Test Duration (hours)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Minimum hours before a test can conclude</p>
              </div>
              <Input
                type="number"
                min={1}
                className="w-[120px]"
                value={formGovernance.minTestDurationHours}
                onChange={(e) => setFormGovernance({ ...formGovernance, minTestDurationHours: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Min Scores Per Version</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Required samples before comparison</p>
              </div>
              <Input
                type="number"
                min={10}
                className="w-[120px]"
                value={formGovernance.minScoresPerVersion}
                onChange={(e) => setFormGovernance({ ...formGovernance, minScoresPerVersion: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Significance Threshold</Label>
                <p className="text-xs text-muted-foreground mt-0.5">p-value threshold (lower = more confidence)</p>
              </div>
              <Input
                type="number"
                step={0.01}
                min={0.01}
                max={0.10}
                className="w-[120px]"
                value={formGovernance.significanceThreshold}
                onChange={(e) => setFormGovernance({ ...formGovernance, significanceThreshold: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Max Concurrent Tests</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Maximum active A/B tests allowed</p>
              </div>
              <Input
                type="number"
                min={1}
                max={5}
                className="w-[120px]"
                value={formGovernance.maxConcurrentTests}
                onChange={(e) => setFormGovernance({ ...formGovernance, maxConcurrentTests: parseInt(e.target.value) || 0 })}
              />
            </div>
          </Card>

          <Card className="bg-card/50 p-4 space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">Deployment & Monitoring</h3>
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Deployment Strategy</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Rollout method for winning versions</p>
              </div>
              <Select
                value={formGovernance.deploymentStrategy}
                onValueChange={(v: 'instant' | 'canary') => setFormGovernance({ ...formGovernance, deploymentStrategy: v })}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instant">Instant</SelectItem>
                  <SelectItem value="canary">Canary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Monitoring Window (hours)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Observation period before full promotion</p>
              </div>
              <Input
                type="number"
                min={1}
                className="w-[120px]"
                value={formGovernance.monitoringWindowHours}
                onChange={(e) => setFormGovernance({ ...formGovernance, monitoringWindowHours: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">
                  Performance Floor{" "}
                  <span className={`font-medium ml-2 ${getPerformanceColor(formGovernance.performanceFloor)}`}>
                    {formGovernance.performanceFloor}
                  </span>
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Auto-rollback if performance drops below this score</p>
              </div>
              <Slider
                className="w-[200px]"
                min={0}
                max={1}
                step={0.05}
                value={[formGovernance.performanceFloor]}
                onValueChange={([v]: number[]) => setFormGovernance({ ...formGovernance, performanceFloor: v })}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="font-medium">Canary Stages</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Traffic percentage steps for canary rollouts</p>
              </div>
              <div className="w-[200px] flex justify-end">
                <p className="text-sm font-mono text-muted-foreground">{formGovernance.canaryStages.join(" → ")}%</p>
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 mt-6 pt-4 border-t bg-background/80 backdrop-blur-sm flex items-center justify-between">
            <Button variant="ghost" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button variant="default" disabled={!isDirty || saving} onClick={handleSave}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
