"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RSIL_PRESETS_MAP, PresetKey } from "@/lib/rsil/presets"
import { RSILGovernance } from "@/lib/rsil/governance"

export interface PresetSelectorProps {
  value?: PresetKey
  defaultValue?: PresetKey
  onPresetChange?: (presetKey: PresetKey, values: RSILGovernance) => void
  className?: string
}

const PRESET_KEYS: PresetKey[] = ['conservative', 'balanced', 'aggressive']

export function PresetSelector({
  value,
  defaultValue = 'balanced',
  onPresetChange,
  className,
}: PresetSelectorProps) {
  const [internalValue, setInternalValue] = React.useState<PresetKey>(value ?? defaultValue)
  
  const selectedValue = value !== undefined ? value : internalValue

  const handleValueChange = (newValue: string) => {
    const key = newValue as PresetKey
    setInternalValue(key)
    if (onPresetChange) {
      onPresetChange(key, RSIL_PRESETS_MAP[key].values)
    }
  }

  return (
    <RadioGroup
      value={selectedValue}
      onValueChange={handleValueChange}
      className={cn("grid gap-4 grid-cols-1 md:grid-cols-3", className)}
    >
      {PRESET_KEYS.map((key) => {
        const preset = RSIL_PRESETS_MAP[key]
        const isSelected = selectedValue === key
        
        return (
          <div key={key} className="relative">
            <RadioGroupItem
              value={key}
              id={`preset-${key}`}
              className="peer sr-only"
            />
            <label
              htmlFor={`preset-${key}`}
              className={cn(
                "flex h-full flex-col cursor-pointer rounded-xl border-2 bg-card p-4 sm:p-6 shadow-sm transition-all hover:bg-accent/50 touch-manipulation",
                isSelected
                  ? "border-primary bg-accent/20"
                  : "border-border"
              )}
            >
              <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm sm:text-base">
                    {preset.label}
                  </span>
                  {key === 'balanced' && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      (Recommended)
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 flex-grow">
                {preset.description}
              </div>
              
              <div className="flex flex-col gap-2 pt-3 sm:pt-4 border-t text-[10px] sm:text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Approval</span>
                  <span className="font-medium">{preset.values.requireApproval ? 'Required' : 'Optional'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Test Duration</span>
                  <span className="font-medium">
                    {preset.values.minTestDurationHours}h - {preset.values.maxTestDurationHours}h
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rollout</span>
                  <span className="font-medium capitalize">{preset.values.deploymentStrategy}</span>
                </div>
              </div>
            </label>
          </div>
        )
      })}
    </RadioGroup>
  )
}
