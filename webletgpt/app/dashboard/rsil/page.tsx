"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { WebletSelector } from "@/components/rsil/weblet-selector"
import { RSILAggregateDashboard } from "@/components/rsil/rsil-aggregate-dashboard"
import { PerformanceChart } from "@/components/rsil/performance-chart"
import { RsilEmptyState } from "@/components/rsil/rsil-empty-state"

import { PromptComparison } from "@/components/rsil/prompt-comparison"
import { ABTestStatus } from "@/components/rsil/ab-test-status"
import { VersionHistory } from "@/components/rsil/version-history"
import { GovernancePanel } from "@/components/rsil/governance-panel"

import type {
  AnalysisResult,
  MetricsData,
  WebletOverview,
  RatingEntry,
} from "@/components/rsil/types"
import type { AggregateData } from "@/components/rsil/rsil-aggregate-dashboard"

type OverviewResponse = {
  weblets: WebletOverview[]
}

type ScoresResponse = {
  analysis: AnalysisResult
  recentRatings: RatingEntry[]
  metrics?: MetricsData
}

export default function RSILDashboardPage() {
  const [weblets, setWeblets] = useState<WebletOverview[]>([])
  const [selectedWebletId, setSelectedWebletId] = useState<string | null>(null)

  const [overviewLoading, setOverviewLoading] = useState(true)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [aggregateData, setAggregateData] = useState<AggregateData | null>(null)
  const [aggregateLoading, setAggregateLoading] = useState(true)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [recentRatings, setRecentRatings] = useState<RatingEntry[]>([])
  const [rsilEnabled, setRsilEnabled] = useState(false)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)

  const [activeTab, setActiveTab] = useState("scores")
  
  const [draftVersion, setDraftVersion] = useState<{ id: string; prompt: string; changelog: string } | null>(null)
  const [currentVersionPrompt, setCurrentVersionPrompt] = useState("")
  const [optimizing, setOptimizing] = useState(false)
  const [versions, setVersions] = useState<Array<{
    id: string
    versionNum: number
    status: string
    avgScore: number | null
    model: string
    prompt: string
    commitMsg: string | null
    createdAt: string | Date
    isAbTest: boolean
  }>>([])

  const fetchAggregate = useCallback(async () => {
    setAggregateLoading(true)
    try {
      const res = await fetch("/api/rsil/aggregate")
      if (!res.ok) throw new Error("Failed to load aggregate data")
      const data: AggregateData = await res.json()
      setAggregateData(data)
    } catch {
      toast.error("Failed to load RSIL aggregate data")
    } finally {
      setAggregateLoading(false)
    }
  }, [])

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const res = await fetch("/api/rsil/overview")
      if (!res.ok) throw new Error("Failed to load RSIL overview")
      const data: OverviewResponse = await res.json()
      setWeblets(data.weblets)
    } catch {
      toast.error("Failed to load RSIL data")
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const fetchScores = useCallback(async (webletId: string) => {
    setScoresLoading(true)
    try {
      const res = await fetch(`/api/rsil/scores?webletId=${webletId}&hours=168`)
      if (!res.ok) throw new Error("Failed to load scores")
      const data: ScoresResponse = await res.json()
      setAnalysis(data.analysis)
      setRecentRatings(data.recentRatings || [])
      setMetrics(data.metrics || null)
    } catch {
      setAnalysis(null)
      setRecentRatings([])
      setMetrics(null)
    } finally {
      setScoresLoading(false)
    }
  }, [])

  const fetchConfig = useCallback(async (webletId: string) => {
    try {
      const res = await fetch(`/api/rsil/config?webletId=${webletId}`)
      if (!res.ok) throw new Error("Failed to load config")
      const data = await res.json()
      setRsilEnabled(data.rsilEnabled)
    } catch {
      setRsilEnabled(false)
    }
  }, [])

  const fetchVersions = useCallback(async (webletId: string) => {
    try {
      const res = await fetch(`/api/weblets/${webletId}/versions`)
      if (!res.ok) throw new Error("Failed to load versions")
      const data = await res.json()
      setVersions(data.versions || [])
      const active = (data.versions || []).find((v: { status: string; prompt: string }) => v.status === "ACTIVE")
      if (active) setCurrentVersionPrompt(active.prompt)
    } catch {
      setVersions([])
    }
  }, [])

  useEffect(() => {
    fetchOverview()
    fetchAggregate()
  }, [fetchOverview, fetchAggregate])

  useEffect(() => {
    if (!selectedWebletId) return
    fetchScores(selectedWebletId)
    fetchConfig(selectedWebletId)
    fetchVersions(selectedWebletId)
  }, [selectedWebletId, fetchScores, fetchConfig, fetchVersions])

  function handleWebletChange(id: string) {
    setSelectedWebletId(id)
    setAnalysis(null)
    setRecentRatings([])
    setMetrics(null)
    setActiveTab("scores")
    setDraftVersion(null)
  }

  async function handleToggleRSIL(enabled: boolean) {
    if (!selectedWebletId) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/rsil/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, rsilEnabled: enabled }),
      })
      if (!res.ok) throw new Error("Failed to update")
      setRsilEnabled(enabled)
      toast.success(enabled ? "RSIL enabled" : "RSIL disabled")
      fetchOverview()
      fetchAggregate()
    } catch {
      toast.error("Failed to toggle RSIL")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleOptimize() {
    if (!selectedWebletId) return
    setOptimizing(true)
    try {
      const res = await fetch("/api/rsil/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId }),
      })
      if (!res.ok) throw new Error("Failed to optimize")
      const data = await res.json()
      setDraftVersion(data.draftVersion)
      setCurrentVersionPrompt(data.currentVersion?.prompt || currentVersionPrompt)
      toast.success("New prompt drafted")
    } catch {
      toast.error("Failed to optimize prompt")
    } finally {
      setOptimizing(false)
    }
  }

  async function handleStartTest(versionId: string) {
    if (!selectedWebletId) return
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, versionId, action: "test" }),
      })
      if (!res.ok) throw new Error("Failed to start A/B test")
      toast.success("A/B test started successfully")
      await fetchVersions(selectedWebletId)
      setActiveTab("abtest")
    } catch {
      toast.error("Failed to start A/B test")
    }
  }

  async function handleDeploy(versionId: string) {
    if (!selectedWebletId) return
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, versionId, action: "deploy" }),
      })
      if (!res.ok) throw new Error("Failed to deploy version")
      toast.success("Version deployed successfully")
      await fetchVersions(selectedWebletId)
      setActiveTab("versions")
    } catch {
      toast.error("Failed to deploy version")
    }
  }

  async function handleConcludeTest(winnerId: string) {
    if (!selectedWebletId) return
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, versionId: winnerId, action: "conclude" }),
      })
      if (!res.ok) throw new Error("Failed to conclude test")
      toast.success("A/B test concluded successfully")
      await fetchVersions(selectedWebletId)
      setActiveTab("versions")
    } catch {
      toast.error("Failed to conclude A/B test")
    }
  }

  async function handleCancelTest() {
    if (!selectedWebletId) return
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, action: "cancel" }),
      })
      if (!res.ok) throw new Error("Failed to cancel test")
      toast.success("A/B test cancelled")
      await fetchVersions(selectedWebletId)
      setActiveTab("versions")
    } catch {
      toast.error("Failed to cancel A/B test")
    }
  }

  async function handleRollback(webletId: string) {
    try {
      const res = await fetch("/api/rsil/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId }),
      })
      if (!res.ok) throw new Error("Failed to rollback")
      toast.success("Rolled back to previous version")
      await fetchVersions(webletId)
    } catch {
      toast.error("Failed to rollback")
    }
  }

  if (overviewLoading && aggregateLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  if (!overviewLoading && weblets.length === 0 && !aggregateLoading && !aggregateData?.perWebletScores.length) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-6" />
            RSIL — Self-Improving AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time Langfuse metrics for RSIL-enabled weblets
          </p>
        </div>
        <RsilEmptyState />
      </div>
    )
  }

  if (!selectedWebletId) {
    return (
      <div className="flex flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-6" />
            RSIL — Self-Improving AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time Langfuse metrics for RSIL-enabled weblets
          </p>
        </motion.div>

        <RSILAggregateDashboard
          data={aggregateData}
          loading={aggregateLoading}
          onSelectWeblet={(id) => {
            handleWebletChange(id)
          }}
        />
      </div>
    )
  }

  function getEventDataValue(eventData: Record<string, unknown> | null, keys: string[]) {
    if (!eventData) return null

    for (const key of keys) {
      const value = eventData[key]
      if (typeof value === "string" && value.trim().length > 0) return value
      if (typeof value === "number") return value
    }

    return null
  }

  const chartData = (metrics?.timeSeries ?? []).map((point) => ({
    ...point,
    date: new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }))

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedWebletId(null)}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Back to Overview
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <WebletSelector
              weblets={weblets}
              selectedId={selectedWebletId}
              onSelect={handleWebletChange}
            />
            <div className="flex items-center gap-2">
              <Switch
                checked={rsilEnabled}
                onCheckedChange={handleToggleRSIL}
                disabled={actionLoading}
              />
              {rsilEnabled ? (
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 hover:text-emerald-500">
                  RSIL ON
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  RSIL OFF
                </Badge>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="scores" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
          <TabsTrigger value="abtest">A/B Test</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="mt-6 space-y-8">
          <PerformanceChart
            timeSeries={chartData}
            dimensionNames={(metrics?.dimensions ?? []).map((d) => d.name)}
          />

          {scoresLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-80 rounded-xl" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Dimensions</h3>
                {analysis?.dimensions && analysis.dimensions.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {analysis.dimensions.map((dim) => {
                      const isWeak = analysis.weakDimensions.includes(dim.name)
                      const metric = metrics?.dimensions.find((m) => m.name === dim.name)
                      return (
                        <motion.div
                          key={dim.name}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.25 }}
                        >
                          <div className={cn(
                            "rounded-xl border bg-card/50 overflow-hidden",
                            isWeak && "border-amber-500/30 bg-amber-500/5"
                          )}>
                            <div className="p-4 flex flex-row items-center justify-between pb-2">
                              <span className="text-sm font-medium text-muted-foreground capitalize">{dim.name}</span>
                              {isWeak && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px] uppercase tracking-wider h-5 px-1.5 font-medium">
                                  Improve
                                </Badge>
                              )}
                            </div>
                            <div className="p-4 pt-0">
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-semibold tracking-tight text-foreground">{(dim.avgValue * 10).toFixed(1)}</span>
                                <span className="text-sm text-muted-foreground font-medium">/ 10</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {metric ? metric.count : dim.sampleSize} samples
                              </p>
                              {metric && (metric.p50 != null || metric.p90 != null) && (
                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground/80 border-t pt-2.5">
                                  {metric.p50 != null && (
                                    <span>p50: <span className="font-medium text-muted-foreground">{metric.p50.toFixed(2)}</span></span>
                                  )}
                                  {metric.p90 != null && (
                                    <span>p90: <span className="font-medium text-muted-foreground">{metric.p90.toFixed(2)}</span></span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground text-sm border rounded-md border-dashed">
                    No dimension scores available yet.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent Ratings</h3>
                {recentRatings.length === 0 ? (
                  <div className="py-8 text-sm text-muted-foreground text-center border rounded-md border-dashed">
                    No individual ratings in this time range yet.
                  </div>
                ) : (
                  <div className="rounded-md border bg-card/50 overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="h-9">Type</TableHead>
                          <TableHead className="h-9">Score</TableHead>
                          <TableHead className="h-9">Trace ID</TableHead>
                          <TableHead className="h-9">Feedback</TableHead>
                          <TableHead className="h-9 text-right">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentRatings.map((entry) => {
                          const numericScore = getEventDataValue(entry.eventData, ["score", "rating", "value"])
                          const traceId = getEventDataValue(entry.eventData, ["traceId", "langfuseTraceId", "trace_id", "sessionTraceId"])
                          const feedback = getEventDataValue(entry.eventData, ["feedback", "comment", "reason", "notes"])

                          return (
                            <TableRow key={entry.id} className="hover:bg-muted/20">
                              <TableCell className="py-2.5">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "uppercase tracking-wide text-[10px] font-medium h-5",
                                    entry.eventType === "thumbs_up" && "text-emerald-500 border-emerald-500/30 bg-emerald-500/5",
                                    entry.eventType === "thumbs_down" && "text-rose-500 border-rose-500/30 bg-rose-500/5"
                                  )}
                                >
                                  {entry.eventType}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 font-medium text-sm">
                                {typeof numericScore === "number"
                                  ? numericScore
                                  : entry.eventType === "thumbs_up"
                                    ? "\uD83D\uDC4D"
                                    : entry.eventType === "thumbs_down"
                                      ? "\uD83D\uDC4E"
                                      : "-"}
                              </TableCell>
                              <TableCell className="py-2.5 font-mono text-xs text-muted-foreground max-w-[180px] truncate">
                                {typeof traceId === "string" ? traceId : "-"}
                              </TableCell>
                              <TableCell className="py-2.5 max-w-[280px] truncate text-sm text-muted-foreground">
                                {typeof feedback === "string" ? feedback : "-"}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(entry.createdAt).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="optimization" className="mt-6">
          <PromptComparison
            currentPrompt={currentVersionPrompt}
            proposedPrompt={draftVersion?.prompt || ""}
            changelog={draftVersion?.changelog || ""}
            draftVersionId={draftVersion?.id || ""}
            webletId={selectedWebletId}
            loading={optimizing}
            onOptimize={handleOptimize}
            onStartTest={handleStartTest}
            onDeploy={handleDeploy}
          />
        </TabsContent>

        <TabsContent value="abtest" className="mt-6">
          <ABTestStatus
            webletId={selectedWebletId}
            onConclude={handleConcludeTest}
            onCancel={handleCancelTest}
          />
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <VersionHistory
            versions={versions}
            webletId={selectedWebletId}
            onRollback={handleRollback}
            onStartTest={handleStartTest}
            onDeploy={handleDeploy}
          />
        </TabsContent>

        <TabsContent value="governance" className="mt-6">
          <GovernancePanel webletId={selectedWebletId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
