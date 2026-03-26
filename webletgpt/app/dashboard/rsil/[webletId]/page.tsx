"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Bot,
  MessageSquare,
  Activity,
  Zap,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Clock,
} from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

import { HealthProgressRing, type Tier } from "@/components/rsil/v2/health-progress-ring"
import { DimensionRadarChart } from "@/components/rsil/dimension-radar-chart"
import { MarketplaceStandingChart } from "@/components/rsil/marketplace-standing-chart"
import { SILSuggestions } from "@/components/rsil/sil-suggestions"
import { PerformanceTrendChart } from "@/components/rsil/performance-trend-chart"
import type { ScoreDimension, RSILDecision, PerformanceTrendPoint, AnalyticsData } from "@/components/rsil/types"

type DimensionScore = ScoreDimension

type Analysis = {
  compositeScore: number
  dimensions: DimensionScore[]
  interactionCount: number
  sampleSize: number
  decision: RSILDecision
  weakDimensions: string[]
}

type ScoresResponse = {
  analysis: Analysis | null
  recentRatings: Array<{
    id: string
    eventType: string
    metadata: unknown
    createdAt: string
  }>
  metrics?: unknown
}

type PerWebletScore = {
  webletId: string
  webletName: string
  compositeScore: number
  dimensions: DimensionScore[]
  interactionCount: number
  decision: RSILDecision
}

type AggregateResponse = {
  perWebletScores: PerWebletScore[]
}

type WebletVersion = {
  id: string
  versionNum: number
  status: "ACTIVE" | "TESTING" | "DRAFT" | "ARCHIVED"
  createdAt: string
  prompt: string
  commitMsg?: string | null
}

type VersionsResponse = {
  data: WebletVersion[]
}

function getVersionsArray(data: VersionsResponse | WebletVersion[]): WebletVersion[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.data)) return data.data
  return []
}

function computeTier(score: number): Tier {
  if (score < 0.4) return "bronze"
  if (score < 0.6) return "silver"
  if (score < 0.8) return "gold"
  return "platinum"
}

function computeMarketplaceDimensions(otherWeblets: PerWebletScore[]): DimensionScore[] {
  if (otherWeblets.length === 0) return []

  const dimMap = new Map<string, { totalValue: number; totalSample: number; totalWeight: number; count: number }>()

  for (const w of otherWeblets) {
    for (const d of w.dimensions) {
      const existing = dimMap.get(d.name)
      if (existing) {
        existing.totalValue += d.avgValue
        existing.totalSample += d.sampleSize
        existing.totalWeight += d.weight
        existing.count += 1
      } else {
        dimMap.set(d.name, {
          totalValue: d.avgValue,
          totalSample: d.sampleSize,
          totalWeight: d.weight,
          count: 1,
        })
      }
    }
  }

  return Array.from(dimMap.entries()).map(([name, acc]) => ({
    name,
    avgValue: acc.totalValue / acc.count,
    sampleSize: Math.round(acc.totalSample / acc.count),
    weight: acc.totalWeight / acc.count,
  }))
}

function computeMarketplaceAvgScore(otherWeblets: PerWebletScore[]): number {
  if (otherWeblets.length === 0) return 0
  const sum = otherWeblets.reduce((acc, w) => acc + w.compositeScore, 0)
  return sum / otherWeblets.length
}

function computePercentile(
  currentScore: number,
  allWeblets: PerWebletScore[]
): { rank: number; total: number; percentile: number } {
  const total = allWeblets.length
  if (total === 0) return { rank: 0, total: 0, percentile: 0 }
  const sorted = [...allWeblets].sort((a, b) => b.compositeScore - a.compositeScore)
  const rank = sorted.findIndex((w) => w.compositeScore <= currentScore) + 1
  const percentile = Math.round(((total - rank + 1) / total) * 100)
  return { rank, total, percentile }
}

const DECISION_BADGE_CONFIG: Record<RSILDecision, { label: string; className: string; icon: React.ElementType }> = {
  NONE: {
    label: "No Action Needed",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    icon: CheckCircle2,
  },
  SUGGESTION: {
    label: "Optimization Suggested",
    className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    icon: TrendingUp,
  },
  AUTO_UPDATE: {
    label: "Auto-Optimizing",
    className: "bg-blue-500/10 text-blue-700 border-blue-500/20",
    icon: Zap,
  },
}

export default function RSILOverviewPage({
  params,
}: {
  params: Promise<{ webletId: string }>
}) {
  const router = useRouter()
  const [webletId, setWebletId] = useState<string | null>(null)
  const [scoresData, setScoresData] = useState<ScoresResponse | null>(null)
  const [aggregateData, setAggregateData] = useState<AggregateResponse | null>(null)
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [versionsData, setVersionsData] = useState<WebletVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then((p) => setWebletId(p.webletId))
  }, [params])

  useEffect(() => {
    if (!webletId) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const results = await Promise.allSettled([
          fetch(`/api/rsil/scores?webletId=${webletId}`),
          fetch("/api/rsil/aggregate"),
          fetch(`/api/rsil/analytics?webletId=${webletId}`),
          fetch(`/api/weblets/${webletId}/versions`),
        ])

        if (!cancelled) {
          const [scoresResult, aggregateResult, analyticsResult, versionsResult] = results

          if (scoresResult.status === "fulfilled" && scoresResult.value.ok) {
            const scores: ScoresResponse = await scoresResult.value.json()
            setScoresData(scores)
          }
          if (aggregateResult.status === "fulfilled" && aggregateResult.value.ok) {
            const aggregate: AggregateResponse = await aggregateResult.value.json()
            setAggregateData(aggregate)
          }
          if (analyticsResult.status === "fulfilled" && analyticsResult.value.ok) {
            const analytics: AnalyticsData = await analyticsResult.value.json()
            setAnalyticsData(analytics)
          }
          if (versionsResult.status === "fulfilled" && versionsResult.value.ok) {
            const versions: VersionsResponse | WebletVersion[] = await versionsResult.value.json()
            setVersionsData(getVersionsArray(versions).slice(0, 5))
          }
        }
      } catch (error) {
        console.error("RSIL overview error:", error)
        toast.error("Failed to load overview data")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [webletId])

  if (loading || !webletId) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-36" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-52" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  const webletScore = aggregateData?.perWebletScores.find((s) => s.webletId === webletId)

  const compositeScore = webletScore?.compositeScore ?? scoresData?.analysis?.compositeScore ?? 0
  const dimensions: DimensionScore[] = webletScore?.dimensions ?? scoresData?.analysis?.dimensions ?? []
  const interactionCount = webletScore?.interactionCount ?? scoresData?.analysis?.interactionCount ?? 0
  const decision: RSILDecision = webletScore?.decision ?? scoresData?.analysis?.decision ?? "NONE"
  const weakDimensions: string[] = scoresData?.analysis?.weakDimensions ?? []

  const hasScoreData = dimensions.length > 0 && (scoresData?.analysis?.sampleSize ?? 0) > 0

  const tier = computeTier(compositeScore)

  const otherWeblets = aggregateData?.perWebletScores.filter((w) => w.webletId !== webletId) ?? []
  const marketplaceDimensions = computeMarketplaceDimensions(otherWeblets)
  const marketplaceAvgScore = computeMarketplaceAvgScore(otherWeblets)

  const allWeblets = aggregateData?.perWebletScores ?? []
  const { rank, total, percentile } = computePercentile(compositeScore, allWeblets)

  const activeVersion = versionsData.find((v) => v.status === "ACTIVE")
  const testingVersion = versionsData.find((v) => v.status === "TESTING")

  const decisionBadge = DECISION_BADGE_CONFIG[decision]
  const DecisionIcon = decisionBadge.icon

  const allWebletsMapped = allWeblets.map((w) => ({
    webletId: w.webletId,
    webletName: w.webletName,
    compositeScore: w.compositeScore,
  }))

  const performanceTrend: PerformanceTrendPoint[] = analyticsData?.performanceTrend ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5 text-xs",
            hasScoreData
              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
              : "border-orange-300 text-orange-700"
          )}
        >
          {hasScoreData ? "Active" : "Pending"}
        </Badge>
      </div>

      {!hasScoreData ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-dashed">
            <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-8 px-6">
              <div className="shrink-0 rounded-full bg-muted p-3">
                <Bot className="size-8 text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1 text-center sm:text-left">
                <h3 className="text-base font-semibold">No evaluation data yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Scores will appear as users interact with your weblet and Langfuse evaluates conversations.
                  {interactionCount > 0 && (
                    <span className="block mt-1">
                      <span className="font-medium text-foreground">{interactionCount.toLocaleString()}</span>{" "}
                      interaction{interactionCount !== 1 ? "s" : ""} recorded — evaluations pending.
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4"
        >
          <Card className="border-border/50 shadow-sm">
            <CardContent className="px-5 py-5">
              <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                <div className="shrink-0">
                  <HealthProgressRing score={compositeScore} tier={tier} size="lg" />
                </div>

                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {total > 1 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">Marketplace Rank</span>
                      <span className="text-2xl font-bold tabular-nums">Top {percentile}%</span>
                      <span className="text-xs text-muted-foreground">
                        #{rank} of {total} weblets
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      <MessageSquare className="size-3 inline mr-1" />
                      Interactions
                    </span>
                    <span className="text-2xl font-bold tabular-nums">
                      {interactionCount.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">Conversations tracked</span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      <Activity className="size-3 inline mr-1" />
                      Active Version
                    </span>
                    <span className="text-2xl font-bold tabular-nums">
                      {activeVersion ? `v${activeVersion.versionNum}` : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {activeVersion ? "Currently deployed" : "No deployment"}
                      {testingVersion && ` · Testing v${testingVersion.versionNum}`}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 col-span-2 sm:col-span-3">
                    <span className="text-xs text-muted-foreground mb-1">SIL Status</span>
                    <Badge
                      variant="outline"
                      className={cn("w-fit gap-1.5 text-xs", decisionBadge.className)}
                    >
                      <DecisionIcon className="size-3" />
                      {decisionBadge.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DimensionRadarChart
              dimensions={dimensions}
              marketplaceDimensions={marketplaceDimensions}
            />
            <MarketplaceStandingChart
              weblets={allWebletsMapped}
              currentWebletId={webletId}
            />
          </div>

          <PerformanceTrendChart trend={performanceTrend} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SILSuggestions
              dimensions={dimensions}
              marketplaceDimensions={marketplaceDimensions}
              decision={decision}
              weakDimensions={weakDimensions}
              compositeScore={compositeScore}
              marketplaceAvgScore={marketplaceAvgScore}
            />
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">Recent Versions</CardTitle>
                  <CardDescription className="text-xs">
                    Latest {versionsData.length} version{versionsData.length !== 1 ? "s" : ""} of your weblet
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/dashboard/rsil/${webletId}/deployments`)}
                  className="gap-2 text-xs"
                >
                  View all
                  <ArrowRight className="size-3" />
                </Button>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {versionsData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <Clock className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No versions yet. Create your first deployment.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {versionsData.map((version) => (
                      <div
                        key={version.id}
                        className="flex items-start justify-between gap-4 rounded-lg border p-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">v{version.versionNum}</span>
                            <Badge
                              variant={
                                version.status === "ACTIVE"
                                  ? "default"
                                  : version.status === "TESTING"
                                  ? "secondary"
                                  : "outline"
                              }
                              className={cn(
                                "text-xs",
                                version.status === "ACTIVE" &&
                                  "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
                                version.status === "TESTING" &&
                                  "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
                              )}
                            >
                              {version.status}
                            </Badge>
                          </div>
                          {version.commitMsg && (
                            <p className="text-xs text-muted-foreground">{version.commitMsg}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {new Date(version.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {!hasScoreData && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-2">
              <div>
                <CardTitle className="text-base font-semibold">Recent Versions</CardTitle>
                <CardDescription className="text-xs">
                  Latest {versionsData.length} version{versionsData.length !== 1 ? "s" : ""} of your weblet
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/dashboard/rsil/${webletId}/deployments`)}
                className="gap-2 text-xs"
              >
                View all
                <ArrowRight className="size-3" />
              </Button>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {versionsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <Clock className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No versions yet. Create your first deployment.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versionsData.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-start justify-between gap-4 rounded-lg border p-3"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">v{version.versionNum}</span>
                          <Badge
                            variant={
                              version.status === "ACTIVE"
                                ? "default"
                                : version.status === "TESTING"
                                ? "secondary"
                                : "outline"
                            }
                            className={cn(
                              "text-xs",
                              version.status === "ACTIVE" &&
                                "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
                              version.status === "TESTING" &&
                                "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
                            )}
                          >
                            {version.status}
                          </Badge>
                        </div>
                        {version.commitMsg && (
                          <p className="text-xs text-muted-foreground">{version.commitMsg}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(version.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
