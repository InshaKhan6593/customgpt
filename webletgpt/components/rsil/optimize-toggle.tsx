"use client"

import { Play, Sparkles } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface OptimizeToggleProps {
  rsilEnabled: boolean
  onToggle: (enabled: boolean) => void
  onRunNow: () => void
  isActionLoading: boolean
}

export function OptimizeToggle({ rsilEnabled, onToggle, onRunNow, isActionLoading }: OptimizeToggleProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 border rounded-lg bg-card">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="space-y-0.5">
          <Label htmlFor="rsil-toggle" className="text-sm font-semibold">
            Auto-Optimization
          </Label>
          <p className="text-sm text-muted-foreground">
            Allow RSIL to automatically analyze interactions and improve instructions.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <div className="flex items-center gap-2">
          <Switch 
            id="rsil-toggle" 
            checked={rsilEnabled} 
            onCheckedChange={onToggle}
            disabled={isActionLoading}
          />
          <Label htmlFor="rsil-toggle" className="text-sm">
            {rsilEnabled ? "ON" : "OFF"}
          </Label>
        </div>
        
        <div className="w-px h-8 bg-border hidden sm:block"></div>
        
        <Button 
          variant="secondary" 
          size="sm"
          onClick={onRunNow} 
          disabled={isActionLoading}
          className="w-full sm:w-auto"
        >
          <Play className="size-4 mr-2" />
          Run Now
        </Button>
      </div>
    </div>
  )
}
