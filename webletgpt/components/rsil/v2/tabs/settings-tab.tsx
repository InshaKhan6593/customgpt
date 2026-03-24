"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PresetSelector } from "../preset-selector"
import { GovernancePanel } from "../../governance-panel"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RSIL_PRESETS_MAP, PresetKey } from "@/lib/rsil/presets"
import { RSILGovernance } from "@/lib/rsil/governance"
import { translateTerm } from "@/lib/rsil/terminology"

interface SettingsTabProps {
  webletId: string
  governance?: RSILGovernance
  onGovernanceUpdate?: (updated: RSILGovernance) => void
}

export function SettingsTab({ webletId, governance, onGovernanceUpdate }: SettingsTabProps) {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey | null>(null)
  const [applying, setApplying] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)

  const applyPreset = async () => {
    if (!selectedPreset) {
      toast.error("Please select a preset first")
      return
    }

    setApplying(true)
    try {
      const preset = RSIL_PRESETS_MAP[selectedPreset]
      const response = await fetch(`/api/rsil/governance?webletId=${webletId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webletId, governance: preset.values }),
      })

      if (!response.ok) {
        throw new Error('Failed to apply preset')
      }

      setRefreshNonce(n => n + 1)
      onGovernanceUpdate?.(preset.values)
      toast.success(`${preset.label} preset applied successfully`)
    } catch (error) {
      toast.error("Failed to apply preset")
      console.error(error)
    } finally {
      setApplying(false)
    }
  }

  const generateSettingsSummary = () => {
    if (!governance) {
      return "No governance settings loaded yet."
    }

    const parts: string[] = []

    if (governance.enabled) {
      parts.push(`Auto-deploy is ON, running ${governance.optimizationFrequency}`)
    } else {
      parts.push("Auto-deploy is OFF (manual mode)")
    }

    if (governance.requireApproval) {
      parts.push("manual approval required for tests")
    } else {
      parts.push("tests run automatically without approval")
    }

    parts.push(`testing new versions for ${governance.minTestDurationHours}h`)

    if (governance.deploymentStrategy === 'canary') {
      parts.push(`rolling out via canary (${governance.canaryStages.join(' → ')}%)`)
    } else {
      parts.push("instant deployment after test success")
    }

    parts.push(`auto-rollback below ${(governance.performanceFloor * 100).toFixed(0)}% quality`)

    return parts.join(", ") + "."
  }

  return (
    <div className="space-y-6">
      {/* Top Section: Preset Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Setup</CardTitle>
          <CardDescription>
            Choose a preset to quickly configure all governance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PresetSelector
            value={selectedPreset ?? undefined}
            onPresetChange={(key) => setSelectedPreset(key)}
          />
          <Button 
            onClick={applyPreset} 
            disabled={!selectedPreset || applying}
            className="w-full"
          >
            {applying ? "Applying..." : "Apply Preset"}
          </Button>
        </CardContent>
      </Card>

      {/* Middle Section: Settings Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Current Settings</CardTitle>
          <CardDescription>
            Plain language overview of your governance configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            {generateSettingsSummary()}
          </p>
        </CardContent>
      </Card>

      {/* Bottom Section: Collapsible Advanced Settings */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced-settings">
          <AccordionTrigger className="px-6 text-base font-semibold">
            Advanced Settings
          </AccordionTrigger>
          <AccordionContent className="px-6">
            <GovernancePanel 
              key={refreshNonce} 
              webletId={webletId} 
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
