"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Plus,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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

  const [selectedImprovementVersionId, setSelectedImprovementVersionId] = useState<string | null>(null)
  
  const [draftVersion, setDraftVersion] = useState<{ id: string; prompt: string; changelog: string } | null>(null)
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }))
        if (res.status === 500) {
          toast.warning("Scoring service is temporarily unreachable. Score data may be incomplete.")
        } else {
          toast.error(errData.error || "Failed to load scores")
        }
        setAnalysis(null)
        setRecentRatings([])
        setMetrics(null)
        return
      }
      const data: ScoresResponse = await res.json()
      setAnalysis(data.analysis)
      setRecentRatings(data.recentRatings || [])
      setMetrics(data.metrics || null)
    } catch {
      toast.warning("Could not reach the scoring service. Score data is unavailable.")
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
      const parsed = Array.isArray(data) ? data : []
      setVersions(parsed)
      setSelectedImprovementVersionId((prev) => {
        if (!parsed.length) return null
        if (prev && parsed.some((v) => v.id === prev)) return prev
        return parsed[0].id
      })
    } catch {
      setVersions([])
      setSelectedImprovementVersionId(null)
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

  useEffect(() => {
    if (!selectedWebletId && weblets.length > 0) {
      setSelectedWebletId(weblets[0].id)
    }
  }, [selectedWebletId, weblets])

  function handleWebletChange(id: string) {
    setSelectedWebletId(id)
    setAnalysis(null)
    setRecentRatings([])
    setMetrics(null)
    setDraftVersion(null)
    setSelectedImprovementVersionId(null)
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }))
        if (res.status === 409) {
          toast.error("An A/B test is already running. Cancel or conclude it from the A/B Test tab before optimizing.")
        } else if (res.status === 404) {
          toast.error(errData.error || "Weblet or active version not found.")
        } else {
          toast.error(errData.error || "Failed to optimize prompt. Please try again.")
        }
        return
      }
      const data = await res.json()
      setDraftVersion(data.draftVersion)
      toast.success("New prompt drafted")
    } catch {
      toast.error("Could not reach the server. Check your connection and try again.")
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

  if (overviewLoading) {
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

  const effectiveSelectedWebletId = selectedWebletId ?? weblets[0]?.id ?? null

  const chartData = (metrics?.timeSeries ?? []).map((point) => ({
    ...point,
    date: new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }))

  const selectedWeblet = weblets.find((w) => w.id === effectiveSelectedWebletId) ?? null
  const selectedWebletScore = aggregateData?.perWebletScores.find((entry) => entry.webletId === effectiveSelectedWebletId)
  const compositeOutOf10 = selectedWebletScore ? Number((selectedWebletScore.compositeScore * 10).toFixed(1)) : 0
  const interactionsCount = selectedWebletScore?.interactionCount ?? selectedWeblet?.interactionCount ?? 0

  const orderedVersions = [...versions].sort((a, b) => b.versionNum - a.versionNum)
  const improvementTimeline = orderedVersions.slice(0, 6)
  const selectedImprovement =
    improvementTimeline.find((v) => v.id === selectedImprovementVersionId) ?? improvementTimeline[0] ?? null

  const latestChanges = (
    draftVersion?.changelog || selectedImprovement?.commitMsg || ""
  )
    .split(/\n|;|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)

  const learningProgress = Math.min(100, Math.round(((analysis?.sampleSize ?? 0) / 150) * 100))
  const weakDimensions = analysis?.weakDimensions ?? []
  const averageResponseSignal =
    analysis?.dimensions && analysis.dimensions.length > 0
      ? Number(
          (
            analysis.dimensions.reduce((sum, dim) => sum + dim.avgValue, 0) /
            analysis.dimensions.length
          ).toFixed(2)
        )
      : 0

  const trendBars = chartData.slice(-14).map((point, index) => {
    const values: number[] = []
    for (const [key, value] of Object.entries(point)) {
      if (key !== "date" && typeof value === "number") {
        values.push(value)
      }
    }

    const avg = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
    const normalized = avg <= 1 ? avg * 100 : avg <= 10 ? avg * 10 : avg
    return {
      id: `${index}-${point.date}`,
      height: Math.max(10, Math.min(100, normalized)),
    }
  })

  const previousScore = selectedImprovement
    ? orderedVersions.find((v) => v.versionNum === selectedImprovement.versionNum - 1)?.avgScore ?? null
    : null
  const currentVersionScore = selectedImprovement?.avgScore ?? null
  const scoreDelta =
    currentVersionScore != null && previousScore != null
      ? Number(((currentVersionScore - previousScore) * 100).toFixed(1))
      : null

  const activeTestVersion = versions.find((version) => version.isAbTest && version.status === "TESTING")

  function getEventDataValue(eventData: Record<string, unknown> | null, keys: string[]) {
    if (!eventData) return null
    for (const key of keys) {
      const value = eventData[key]
      if (typeof value === "string" && value.trim().length > 0) return value
      if (typeof value === "number") return value
    }
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-semibold tracking-tight">RSIL Dashboard</h1>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-3 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">RSIL</CardTitle>
            <CardDescription>Self-Improving AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Weblets</span>
              <Button variant="outline" size="sm" className="h-7 px-2">
                <Plus className="size-3.5" />
              </Button>
            </div>

            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-2">
                {weblets.map((weblet) => {
                  const selected = weblet.id === effectiveSelectedWebletId
                  return (
                    <Button
                      key={weblet.id}
                      type="button"
                      variant={selected ? "secondary" : "outline"}
                      className="h-auto w-full justify-start p-3 text-left"
                      onClick={() => handleWebletChange(weblet.id)}
                    >
                      <div className="w-full">
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-medium">{weblet.name}</span>
                          {weblet.rsilEnabled && <span className="mt-1 size-2 rounded-full bg-emerald-500" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {weblet.interactionCount.toLocaleString()} conversations
                        </p>
                      </div>
                    </Button>
                  )
                })}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">RSIL Enabled</span>
              <Switch checked={rsilEnabled} onCheckedChange={handleToggleRSIL} disabled={actionLoading} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-9 xl:col-span-10">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{selectedWeblet?.name ?? "Selected Weblet"}</h2>
                  <p className="text-sm text-muted-foreground">Self-improvement analytics and optimization</p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-2xl font-bold">{compositeOutOf10.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">Current composite score</div>
                  </div>
                  <div className="h-10 w-px bg-border" />
                  <Badge variant={rsilEnabled ? "default" : "outline"} className={rsilEnabled ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : ""}>
                    {rsilEnabled ? "Active" : "Paused"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-lg border p-2">
                    <TrendingUp className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-emerald-500">
                    <ArrowUpRight className="size-4" />
                    {scoreDelta != null && scoreDelta >= 0 ? "+" : ""}
                    {scoreDelta != null ? scoreDelta.toFixed(1) : "0.0"}%
                  </div>
                </div>
                <div className="text-2xl font-bold">{compositeOutOf10.toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">Avg User Rating</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-lg border p-2">
                    <Zap className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-emerald-500">
                    <ArrowUpRight className="size-4" />
                    {Math.round(averageResponseSignal * 10)}%
                  </div>
                </div>
                <div className="text-2xl font-bold">{Math.round(averageResponseSignal * 100)}%</div>
                <p className="text-sm text-muted-foreground">Response Accuracy</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-lg border p-2">
                    <MessageSquare className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-rose-500">
                    <ArrowDownRight className="size-4" />
                    {analysis?.weakDimensions.length ?? 0}
                  </div>
                </div>
                <div className="text-2xl font-bold">{analysis?.sampleSize ?? 0}</div>
                <p className="text-sm text-muted-foreground">Scored Interactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-start justify-between">
                  <div className="rounded-lg border p-2">
                    <Users className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1 text-sm font-medium text-emerald-500">
                    <ArrowUpRight className="size-4" />
                    {aggregateData?.optimizations30dCount ?? 0}
                  </div>
                </div>
                <div className="text-2xl font-bold">{interactionsCount.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">Conversations Analyzed</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Card>
                <CardHeader className="border-b pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <CardTitle>Improvement Timeline</CardTitle>
                      <CardDescription>System prompt evolution and performance impact</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="size-4 text-emerald-500" />
                      <span>Next analysis in</span>
                      <span className="font-medium text-emerald-500">47 minutes</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleOptimize} disabled={optimizing || !effectiveSelectedWebletId}>
                      {optimizing ? "Optimizing..." : "Optimize Prompt"}
                    </Button>
                    {selectedImprovement && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartTest(selectedImprovement.id)}
                          disabled={!effectiveSelectedWebletId}
                        >
                          Start A/B Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeploy(selectedImprovement.id)}
                          disabled={!effectiveSelectedWebletId}
                        >
                          Deploy Version
                        </Button>
                      </>
                    )}
                    {activeTestVersion && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConcludeTest(activeTestVersion.id)}
                          disabled={!effectiveSelectedWebletId}
                        >
                          Conclude Test
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelTest} disabled={!effectiveSelectedWebletId}>
                          Cancel Test
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => effectiveSelectedWebletId && handleRollback(effectiveSelectedWebletId)}
                      disabled={!effectiveSelectedWebletId}
                    >
                      Rollback
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {improvementTimeline.length > 0 ? (
                      improvementTimeline.map((version) => {
                        const previous = orderedVersions.find((v) => v.versionNum === version.versionNum - 1)
                        const delta =
                          version.avgScore != null && previous?.avgScore != null
                            ? Number(((version.avgScore - previous.avgScore) * 100).toFixed(1))
                            : null

                        return (
                          <button
                            key={version.id}
                            type="button"
                            onClick={() => setSelectedImprovementVersionId(version.id)}
                            className={`w-full rounded-xl border p-4 text-left transition-colors ${
                              selectedImprovement?.id === version.id
                                ? "border-primary/40 bg-primary/5"
                                : "border-border hover:bg-muted/40"
                            }`}
                          >
                            <div className="mb-3 flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`rounded-lg border p-2 ${version.status === "ACTIVE" ? "text-emerald-500" : "text-muted-foreground"}`}>
                                  <CheckCircle2 className="size-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">v{version.versionNum}</span>
                                    {version.status === "ACTIVE" && (
                                      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">Active</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(version.createdAt).toLocaleString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                    {version.model ? ` • ${version.model}` : ""}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className={`size-4 text-muted-foreground transition-transform ${selectedImprovement?.id === version.id ? "rotate-90" : ""}`} />
                            </div>

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                              <div className="text-center">
                                <div className="text-base font-semibold text-emerald-500">{delta != null && delta >= 0 ? "+" : ""}{delta?.toFixed(1) ?? "0.0"}%</div>
                                <div className="text-[11px] text-muted-foreground">Score Delta</div>
                              </div>
                              <div className="text-center">
                                <div className="text-base font-semibold">{version.avgScore != null ? (version.avgScore * 10).toFixed(1) : "-"}</div>
                                <div className="text-[11px] text-muted-foreground">Avg Score</div>
                              </div>
                              <div className="text-center">
                                <div className="text-base font-semibold">{version.status}</div>
                                <div className="text-[11px] text-muted-foreground">Status</div>
                              </div>
                              <div className="text-center">
                                <div className="text-base font-semibold">{version.isAbTest ? "A/B" : "Direct"}</div>
                                <div className="text-[11px] text-muted-foreground">Deploy Type</div>
                              </div>
                            </div>
                          </button>
                        )
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No version activity yet.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Trends</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  {trendBars.length > 0 ? (
                    <>
                      <div className="flex h-48 items-end gap-1.5">
                        {trendBars.map((bar) => (
                          <div key={bar.id} className="flex-1">
                            <div className="w-full rounded-t-sm bg-primary/70 transition-colors hover:bg-primary" style={{ height: `${bar.height}%` }} />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{chartData[0]?.date ?? "Start"}</span>
                        <span>{chartData[chartData.length - 1]?.date ?? "Now"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No trend data available yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Brain className="size-4" />
                    Active Learning
                  </CardTitle>
                  <CardDescription>Analyzing patterns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Conversations processed</span>
                    <span className="font-medium">{analysis?.sampleSize ?? 0} / 150</span>
                  </div>
                  <Progress value={learningProgress} />
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-sm text-muted-foreground">Detected patterns:</p>
                    {weakDimensions.length > 0 ? (
                      weakDimensions.slice(0, 2).map((dimension) => (
                        <div key={dimension} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="mt-0.5 size-4 text-amber-500" />
                          <span className="text-muted-foreground">Improve {dimension.replaceAll("_", " ")} signals</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No weak patterns detected yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Latest Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  {latestChanges.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Detail</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {latestChanges.map((change, idx) => (
                            <TableRow key={`${change}-${idx}`}>
                              <TableCell>
                                <Badge variant="outline">Change {idx + 1}</Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{change}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No changelog entries available yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>RSIL Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Weak dimensions</span>
                    <span className="font-semibold">{analysis?.weakDimensions.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Low score trace IDs</span>
                    <span className="font-semibold">{analysis?.lowScoredTraceIds.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">A/B tests active</span>
                    <span className="font-semibold">{aggregateData?.activeABTestCount ?? 0}</span>
                  </div>
                  <div className="pt-3 mt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Optimization runs (30d)</span>
                      <span className="text-lg font-bold text-emerald-500">{aggregateData?.optimizations30dCount ?? 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Ratings</CardTitle>
                </CardHeader>
                <CardContent>
                  {scoresLoading ? (
                    <Skeleton className="h-28 w-full" />
                  ) : recentRatings.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead className="text-right">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentRatings.slice(0, 5).map((entry) => {
                            const numericScore = getEventDataValue(entry.eventData, ["score", "rating", "value"])
                            return (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  <Badge variant="outline" className="uppercase text-[10px] tracking-wide">
                                    {entry.eventType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  {typeof numericScore === "number" ? numericScore : "-"}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
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
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent ratings in this time range.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
