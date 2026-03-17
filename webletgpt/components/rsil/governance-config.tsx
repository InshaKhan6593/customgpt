"use client"

import * as React from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { GovernanceConfig } from "./types"

interface GovernanceConfigFormProps {
  initialConfig: GovernanceConfig | null
  onSave: (config: GovernanceConfig) => void
  isSaving: boolean
}

const DEFAULT_CONFIG: GovernanceConfig = {
  minInteractionsBeforeOptimize: 100,
  cooldownHours: 24,
  maxUpdatesPerDay: 1,
  minTestDurationHours: 48,
  requireCreatorApproval: false,
  performanceFloor: 3.0,
  autoOptimizationEnabled: false,
  autoOptimizationFrequency: 'daily',
  autoOptimizationHour: 0,
}

const FREQUENCY_OPTIONS: Array<{ value: GovernanceConfig['autoOptimizationFrequency']; label: string }> = [
  { value: 'every_6h', label: 'Every 6 Hours' },
  { value: 'every_12h', label: 'Every 12 Hours' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${hour.toString().padStart(2, '0')}:00 UTC`,
}))

export function GovernanceConfigForm({ initialConfig, onSave, isSaving }: GovernanceConfigFormProps) {
  const [config, setConfig] = React.useState<GovernanceConfig>(initialConfig || DEFAULT_CONFIG)

  // Update internal state if initialConfig changes (e.g. on weblet switch)
  React.useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig)
    }
  }, [initialConfig])

  const handleChange = (key: keyof GovernanceConfig, value: GovernanceConfig[keyof GovernanceConfig]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(config)
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Governance Settings</CardTitle>
          <CardDescription>
            Configure the boundaries and constraints for RSIL auto-optimization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4 my-1">
            <div className="space-y-0.5">
              <Label className="text-base">Auto-Optimization Schedule</Label>
              <p className="text-sm text-muted-foreground">
                Enable scheduled RSIL optimization runs for this weblet.
              </p>
            </div>
            <Switch
              checked={config.autoOptimizationEnabled}
              onCheckedChange={(checked) => handleChange('autoOptimizationEnabled', checked)}
            />
          </div>

          {config.autoOptimizationEnabled ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="min-interactions">Min Data Before Optimize (Interactions)</Label>
                  <Input
                    id="min-interactions"
                    type="number"
                    min={10}
                    value={config.minInteractionsBeforeOptimize}
                    onChange={(e) => handleChange('minInteractionsBeforeOptimize', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Minimum number of user interactions needed to evaluate performance.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cooldown">Cooldown Period (Hours)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    min={1}
                    value={config.cooldownHours}
                    onChange={(e) => handleChange('cooldownHours', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Wait time between concluding one test and starting the next.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-test">Min Test Duration (Hours)</Label>
                  <Input
                    id="min-test"
                    type="number"
                    min={1}
                    value={config.minTestDurationHours}
                    onChange={(e) => handleChange('minTestDurationHours', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">How long to run an A/B test before deciding a winner.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="perf-floor">Auto-Rollback Below Rating (0-10)</Label>
                  <Input
                    id="perf-floor"
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={config.performanceFloor}
                    onChange={(e) => handleChange('performanceFloor', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-muted-foreground">Automatically revert if score drops below this threshold.</p>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="auto-opt-frequency">Frequency</Label>
                  <Select
                    value={config.autoOptimizationFrequency}
                    onValueChange={(value: GovernanceConfig['autoOptimizationFrequency']) =>
                      handleChange('autoOptimizationFrequency', value)
                    }
                  >
                    <SelectTrigger id="auto-opt-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-opt-hour">Preferred Hour (UTC)</Label>
                  <Select
                    value={String(config.autoOptimizationHour)}
                    onValueChange={(value) => handleChange('autoOptimizationHour', Number(value))}
                  >
                    <SelectTrigger id="auto-opt-hour">
                      <SelectValue placeholder="Select UTC hour" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Auto-optimization is disabled. Use the &quot;Run Now&quot; button to optimize manually.
            </p>
          )}

          <div className="flex items-center justify-between rounded-lg border p-4 my-1">
            <div className="space-y-0.5">
              <Label className="text-base">Require Creator Approval</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, RSIL will only suggest updates. You must manually review and apply them.
              </p>
            </div>
            <Switch
              checked={config.requireCreatorApproval}
              onCheckedChange={(checked) => handleChange('requireCreatorApproval', checked)}
            />
          </div>
        </CardContent>
        <CardFooter className="bg-muted/20 border-t py-4 justify-end">
          <Button type="submit" disabled={isSaving}>
            <Save className="size-4 mr-2" />
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
