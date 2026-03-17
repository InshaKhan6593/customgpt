"use client"

import { motion } from "framer-motion"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  GitBranch,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { AnalysisResult, LatestVersionInfo } from "./types"

interface RSILOverviewProps {
  analysis: AnalysisResult | null
  latestVersion: LatestVersionInfo | null
  totalVersions: number
  hasActiveTest: boolean
  interactionCount: number
  loading: boolean
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: "easeOut" as const },
  }),
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function RSILOverview({
  analysis,
  latestVersion,
  totalVersions,
  hasActiveTest,
  interactionCount,
  loading,
}: RSILOverviewProps) {
  if (loading) {
    return <OverviewSkeleton />
  }

  const compositeScore = analysis?.compositeScore ?? 0
  const sampleSize = analysis?.sampleSize ?? 0
  const decision = analysis?.decision ?? "NONE"
  const weakDimensions = analysis?.weakDimensions ?? []

  const decisionLabel: Record<string, { text: string; variant: "default" | "secondary" | "outline" }> = {
    NONE: { text: "Stable", variant: "outline" },
    SUGGESTION: { text: "Suggestion Ready", variant: "secondary" },
    AUTO_UPDATE: { text: "Auto-Update", variant: "default" },
  }

  const decisionInfo = decisionLabel[decision] || decisionLabel.NONE

  const cards = [
    {
      title: "Composite Score",
      icon: Target,
      value: compositeScore > 0 ? compositeScore.toFixed(1) : "-",
      suffix: compositeScore > 0 ? "/ 10" : "",
      detail: latestVersion
        ? `V${latestVersion.versionNum} · ${latestVersion.status}`
        : "No version deployed",
      accent:
        compositeScore >= 7
          ? "text-emerald-500"
          : compositeScore >= 4
            ? "text-amber-500"
            : compositeScore > 0
              ? "text-rose-500"
              : "text-muted-foreground",
    },
    {
      title: "Interactions",
      icon: BarChart3,
      value: interactionCount.toLocaleString(),
      suffix: sampleSize > 0 ? `(${sampleSize} rated)` : "",
      detail: interactionCount === 0 ? "No chats yet" : sampleSize === 0 ? "No ratings yet — users can rate with 👍/👎" : "Chat sessions with this weblet",
      accent: "text-foreground",
    },
    {
      title: "Decision",
      icon: Sparkles,
      value: decisionInfo.text,
      suffix: "",
      detail: analysis?.reason || "Awaiting analysis",
      accent: "text-foreground",
      badge: decisionInfo,
    },
    {
      title: "Versions",
      icon: GitBranch,
      value: totalVersions.toString(),
      suffix: hasActiveTest ? "A/B active" : "total",
      detail: hasActiveTest ? "Test in progress" : `${weakDimensions.length} weak dimension${weakDimensions.length !== 1 ? "s" : ""}`,
      accent: "text-foreground",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
        >
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-2xl font-bold", card.accent)}>
                  {card.value}
                </span>
                {card.suffix && (
                  <span className="text-sm text-muted-foreground">
                    {card.suffix}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {card.detail}
              </p>
              {card.title === "Composite Score" && compositeScore > 0 && (
                <Progress
                  value={compositeScore * 10}
                  className="mt-2 h-1.5"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
