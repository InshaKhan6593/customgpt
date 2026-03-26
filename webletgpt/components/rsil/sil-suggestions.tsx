"use client"

import * as React from "react"
import { CheckCircle2, AlertTriangle, Zap, TrendingUp } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ScoreDimension, RSILDecision } from "./types"

interface SILSuggestionsProps {
  dimensions: ScoreDimension[]
  marketplaceDimensions: ScoreDimension[]
  decision: RSILDecision
  weakDimensions: string[]
  compositeScore: number
  marketplaceAvgScore: number
}

function capitalizeDimension(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const DECISION_CONFIG: Record<
  RSILDecision,
  { label: string; description: string; icon: React.ElementType; badgeClass: string; bannerClass: string }
> = {
  NONE: {
    label: "No Optimization Needed",
    description: "Your weblet is performing well. No optimization needed.",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    bannerClass: "bg-emerald-500/5 border-emerald-500/20",
  },
  SUGGESTION: {
    label: "Optimization Recommended",
    description: "Optimization recommended. SIL has identified areas for improvement.",
    icon: TrendingUp,
    badgeClass: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    bannerClass: "bg-amber-500/5 border-amber-500/20",
  },
  AUTO_UPDATE: {
    label: "Auto-Optimization Active",
    description: "Auto-optimization is active and working on improvements.",
    icon: Zap,
    badgeClass: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    bannerClass: "bg-blue-500/5 border-blue-500/20",
  },
}

export function SILSuggestions({
  dimensions,
  marketplaceDimensions,
  decision,
  compositeScore,
  marketplaceAvgScore,
}: SILSuggestionsProps) {
  const isEmpty = !dimensions || dimensions.length === 0

  const decisionConfig = DECISION_CONFIG[decision]
  const DecisionIcon = decisionConfig.icon

  const dimensionComparisons = React.useMemo(() => {
    if (isEmpty) return []
    return dimensions.map((dim) => {
      const marketplaceDim = marketplaceDimensions.find((md) => md.name === dim.name)
      const marketplaceAvg = marketplaceDim?.avgValue ?? null
      const isBelow = marketplaceAvg !== null && dim.avgValue < marketplaceAvg
      return {
        name: dim.name,
        displayName: capitalizeDimension(dim.name),
        score: dim.avgValue,
        marketplaceAvg,
        isBelow,
      }
    })
  }, [dimensions, marketplaceDimensions, isEmpty])

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-base font-semibold">SIL Suggestions</CardTitle>
        <CardDescription className="text-xs">
          Actionable insights based on your performance vs marketplace
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4",
            decisionConfig.bannerClass
          )}
        >
          <DecisionIcon className="size-5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{decisionConfig.description}</p>
              <Badge variant="outline" className={cn("text-xs shrink-0", decisionConfig.badgeClass)}>
                {decisionConfig.label}
              </Badge>
            </div>
            {marketplaceAvgScore > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Your score: {(compositeScore * 100).toFixed(1)}% · Marketplace avg:{" "}
                {(marketplaceAvgScore * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {isEmpty ? (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border-dashed border-border/50 rounded-md">
            Dimension data will appear after your weblet receives conversations
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {dimensionComparisons.map((dim) => (
              <div
                key={dim.name}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  dim.isBelow
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-emerald-500/5 border-emerald-500/15"
                )}
              >
                {dim.isBelow ? (
                  <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-emerald-600" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{dim.displayName}</p>
                  {dim.isBelow && dim.marketplaceAvg !== null ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your score ({(dim.score * 100).toFixed(1)}%) is below average (
                      {(dim.marketplaceAvg * 100).toFixed(1)}%). Running SIL optimization could improve this.
                    </p>
                  ) : dim.marketplaceAvg !== null ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {dim.displayName} is strong ({(dim.score * 100).toFixed(1)}% vs avg{" "}
                      {(dim.marketplaceAvg * 100).toFixed(1)}%)
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Score: {(dim.score * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
