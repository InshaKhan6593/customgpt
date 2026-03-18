"use client"

import { useEffect, useState, useCallback } from "react"
import { 
  ArrowLeft, 
  Sparkles, 
  BarChart3, 
  Activity, 
  Zap, 
  TrendingUp,
  Clock,
  ChevronRight
} from "lucide-react"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import { WebletSelector } from "@/components/rsil/weblet-selector"
import { RSILAggregateDashboard } from "@/components/rsil/rsil-aggregate-dashboard"
import { RsilEmptyState } from "@/components/rsil/rsil-empty-state"
import { PromptComparison } from "@/components/rsil/prompt-comparison"
import { ABTestStatus } from "@/components/rsil/ab-test-status"
import { VersionHistory } from "@/components/rsil/version-history"
import { GovernancePanel } from "@/components/rsil/governance-panel"
import { AnalyticsTab } from "@/components/rsil/analytics-tab"

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

// Premium Performance Chart Component
function PremiumPerformanceChart({ 
  timeSeries, 
  dimensionNames 
}: { 
  timeSeries: Array<{ date: string; [key: string]: string | number }>
  dimensionNames: string[] 
}) {
  const CHART_COLORS = {
    primary: "#171717",
    secondary: "#525252",
    tertiary: "#737373",
    quaternary: "#a3a3a3",
    quinary: "#d4d4d4",
  }

  const chartConfig: ChartConfig = {}
  dimensionNames.forEach((name, i) => {
    const colors = Object.values(CHART_COLORS)
    chartConfig[name] = {
      label: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
      color: colors[i % colors.length],
    }
  })

  if (!timeSeries || timeSeries.length === 0) {
    return (
      <Card className="border-border/40 bg-card/30 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium text-foreground">Performance Trends</CardTitle>
              <CardDescription className="text-xs text-muted-foreground/70">Score dimensions over time</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Activity className="size-3.5" />
              <span>Real-time</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground/60 border border-dashed border-border/30 rounded-lg bg-muted/5">
            Score data will appear after conversations
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40 bg-card/30 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-foreground">Performance Trends</CardTitle>
            <CardDescription className="text-xs text-muted-foreground/70">Score dimensions over time</CardDescription>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Activity className="size-3.5" />
            <span>Real-time</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                {dimensionNames.map((name, i) => (
                  <linearGradient key={name} id={`gradient-${name}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartConfig[name]?.color || '#171717'} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={chartConfig[name]?.color || '#171717'} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="var(--border)" 
                strokeOpacity={0.3} 
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                fontSize={11}
                tick={{ fill: "var(--muted-foreground)", opacity: 0.6 }}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(v) => v.toFixed(1)}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                fontSize={11}
                tick={{ fill: "var(--muted-foreground)", opacity: 0.6 }}
              />
              <ChartTooltip 
                content={<ChartTooltipContent indicator="line" />}
                cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              {dimensionNames.map((name) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={chartConfig[name]?.color}
                  fill={`url(#gradient-${name})`}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Premium Score Dimension Card
function ScoreDimensionCard({ 
  name, 
  avgValue, 
  sampleSize, 
  isWeak,
  p50,
  p90
}: { 
  name: string
  avgValue: number
  sampleSize: number
  isWeak: boolean
  p50?: number | null
  p90?: number | null
}) {
  const score = avgValue * 10
  const getScoreColor = () => {
    if (score >= 7) return "text-foreground"
    if (score >= 4) return "text-muted-foreground"
    return "text-muted-foreground/60"
  }

  return (
    <Card className={cn(
      "border-border/40 bg-card/30 backdrop-blur-sm transition-all duration-200 hover:border-border/60 hover:bg-card/40",
      isWeak && "border-amber-500/20 bg-amber-500/[0.02]"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
            {name}
          </span>
          {isWeak && (
            <Badge 
              variant="outline" 
              className="text-[10px] h-5 px-1.5 font-medium bg-amber-500/5 text-amber-600 border-amber-500/20"
            >
              Needs Improvement
            </Badge>
          )}
        </div>
        
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-3xl font-semibold tracking-tight tabular-nums", getScoreColor())}>
            {score.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground/50 font-medium">/ 10</span>
        </div>
        
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground/60">{sampleSize} samples</span>
            {(p50 != null || p90 != null) && (
              <div className="flex items-center gap-3 text-muted-foreground/50">
                {p50 != null && (
                  <span>p50: <span className="text-muted-foreground/70 font-medium">{p50.toFixed(2)}</span></span>
                )}
                {p90 != null && (
                  <span>p90: <span className="text-muted-foreground/70 font-medium">{p90.toFixed(2)}</span></span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Premium Rating Entry Row
function RatingRow({ 
  entry, 
  getEventDataValue 
}: { 
  entry: RatingEntry
  getEventDataValue: (eventData: Record<string, unknown> | null, keys: string[]) => string | number | null
}) {
  const numericScore = getEventDataValue(entry.eventData, ["score", "rating", "value"])
  const traceId = getEventDataValue(entry.eventData, ["traceId", "langfuseTraceId", "trace_id", "sessionTraceId"])
  const feedback = getEventDataValue(entry.eventData, ["feedback", "comment", "reason", "notes"])

  return (
    <TableRow className="hover:bg-muted/5 border-border/30">
      <TableCell className="py-3">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium h-5 px-2 uppercase tracking-wide border-0",
            entry.eventType === "thumbs_up" && "bg-emerald-500/10 text-emerald-600",
            entry.eventType === "thumbs_down" && "bg-rose-500/10 text-rose-500"
          )}
        >
          {entry.eventType}
        </Badge>
      </TableCell>
      <TableCell className="py-3 font-medium text-sm tabular-nums text-foreground/80">
        {typeof numericScore === "number"
          ? numericScore
          : entry.eventType === "thumbs_up"
            ? "+"
            : entry.eventType === "thumbs_down"
              ? "-"
              : "-"}
      </TableCell>
      <TableCell className="py-3 font-mono text-xs text-muted-foreground/60 max-w-[160px] truncate">
        {typeof traceId === "string" ? traceId : "-"}
      </TableCell>
      <TableCell className="py-3 max-w-[240px] truncate text-sm text-muted-foreground/70">
        {typeof feedback === "string" ? feedback : "-"}
      </TableCell>
      <TableCell className="py-3 text-right text-xs text-muted-foreground/50 whitespace-nowrap">
        {new Date(entry.createdAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </TableCell>
    </TableRow>
  )
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }))
        if (res.status === 500) {
          toast.warning("Scoring service is temporarily unreachable.")
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
      toast.warning("Could not reach the scoring service.")
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
       setVersions(Array.isArray(data) ? data : [])
       const active = (Array.isArray(data) ? data : []).find((v: { status: string; prompt: string }) => v.status === "ACTIVE")
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
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }))
        if (res.status === 409) {
          toast.error("An A/B test is already running.")
        } else if (res.status === 404) {
          toast.error(errData.error || "Weblet or active version not found.")
        } else {
          toast.error(errData.error || "Failed to optimize prompt.")
        }
        return
      }
      const data = await res.json()
      setDraftVersion(data.draftVersion)
      setCurrentVersionPrompt(data.currentVersion?.prompt || currentVersionPrompt)
      toast.success("New prompt drafted")
    } catch {
      toast.error("Could not reach the server.")
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

  function getEventDataValue(eventData: Record<string, unknown> | null, keys: string[]) {
    if (!eventData) return null
    for (const key of keys) {
      const value = eventData[key]
      if (typeof value === "string" && value.trim().length > 0) return value
      if (typeof value === "number") return value
    }
    return null
  }

  // Loading State
  if (overviewLoading && aggregateLoading) {
    return (
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72 bg-muted/30" />
          <Skeleton className="h-4 w-96 bg-muted/20" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl bg-muted/20" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl bg-muted/20" />
      </div>
    )
  }

  // Empty State
  if (!overviewLoading && weblets.length === 0 && !aggregateLoading && !aggregateData?.perWebletScores.length) {
    return (
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-foreground/5">
              <Sparkles className="size-5 text-foreground/70" />
            </div>
            RSIL Dashboard
          </h1>
          <p className="text-sm text-muted-foreground/70">
            Self-improving AI with real-time optimization and A/B testing
          </p>
        </div>
        <RsilEmptyState />
      </div>
    )
  }

  // Aggregate Overview (no weblet selected)
  if (!selectedWebletId) {
    return (
      <div className="flex flex-col gap-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-foreground/5">
              <Sparkles className="size-5 text-foreground/70" />
            </div>
            RSIL Dashboard
          </h1>
          <p className="text-sm text-muted-foreground/70">
            Self-improving AI with real-time optimization and A/B testing
          </p>
        </div>

        <RSILAggregateDashboard
          data={aggregateData}
          loading={aggregateLoading}
          onSelectWeblet={(id) => handleWebletChange(id)}
        />
      </div>
    )
  }

  // Weblet Detail View
  const chartData = (metrics?.timeSeries ?? []).map((point) => ({
    ...point,
    date: new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }))

  const selectedWeblet = weblets.find(w => w.id === selectedWebletId)

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedWebletId(null)}
            className="h-7 px-2 text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
          >
            <ArrowLeft className="size-3.5 mr-1" />
            Overview
          </Button>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground/80 font-medium">{selectedWeblet?.name || 'Weblet'}</span>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {selectedWeblet?.name || 'Weblet Details'}
            </h1>
            <p className="text-sm text-muted-foreground/60">
              Performance metrics and optimization controls
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <WebletSelector
              weblets={weblets}
              selectedId={selectedWebletId}
              onSelect={handleWebletChange}
            />
            <div className="flex items-center gap-3 pl-4 border-l border-border/30">
              <Switch
                checked={rsilEnabled}
                onCheckedChange={handleToggleRSIL}
                disabled={actionLoading}
                className="data-[state=checked]:bg-foreground"
              />
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wider h-5 px-2 border-0",
                  rsilEnabled 
                    ? "bg-emerald-500/10 text-emerald-600" 
                    : "bg-muted/50 text-muted-foreground/60"
                )}
              >
                {rsilEnabled ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scores" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/30 border border-border/30 p-0.5 h-9">
          <TabsTrigger 
            value="scores" 
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 h-7"
          >
            <TrendingUp className="size-3.5 mr-1.5" />
            Scores
          </TabsTrigger>
          <TabsTrigger 
            value="optimization" 
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 h-7"
          >
            <Zap className="size-3.5 mr-1.5" />
            Optimization
          </TabsTrigger>
          <TabsTrigger 
            value="abtest" 
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 h-7"
          >
            A/B Test
          </TabsTrigger>
          <TabsTrigger 
            value="versions" 
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 h-7"
          >
            <Clock className="size-3.5 mr-1.5" />
            Versions
          </TabsTrigger>
          <TabsTrigger 
            value="governance" 
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 h-7"
          >
            Governance
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 h-7"
          >
            <BarChart3 className="size-3.5 mr-1.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Scores Tab */}
        <TabsContent value="scores" className="mt-6 space-y-6">
          {/* Performance Chart */}
          <PremiumPerformanceChart
            timeSeries={chartData}
            dimensionNames={(metrics?.dimensions ?? []).map((d) => d.name)}
          />

          {scoresLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl bg-muted/20" />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Score Dimensions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                    Score Dimensions
                  </h3>
                  {analysis?.dimensions && analysis.dimensions.length > 0 && (
                    <span className="text-xs text-muted-foreground/50">
                      {analysis.dimensions.length} metrics tracked
                    </span>
                  )}
                </div>
                
                {analysis?.dimensions && analysis.dimensions.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {analysis.dimensions.map((dim) => {
                      const metric = metrics?.dimensions.find((m) => m.name === dim.name)
                      return (
                        <ScoreDimensionCard
                          key={dim.name}
                          name={dim.name}
                          avgValue={dim.avgValue}
                          sampleSize={metric ? metric.count : dim.sampleSize}
                          isWeak={analysis.weakDimensions.includes(dim.name)}
                          p50={metric?.p50}
                          p90={metric?.p90}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <Card className="border-border/30 border-dashed bg-transparent">
                    <CardContent className="flex items-center justify-center py-12">
                      <p className="text-sm text-muted-foreground/50">
                        No dimension scores available yet
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Recent Ratings */}
              <div className="space-y-4">
                <h3 className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                  Recent Ratings
                </h3>
                
                {recentRatings.length === 0 ? (
                  <Card className="border-border/30 border-dashed bg-transparent">
                    <CardContent className="flex items-center justify-center py-12">
                      <p className="text-sm text-muted-foreground/50">
                        No ratings in this time range
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border/40 bg-card/30 backdrop-blur-sm overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/30 hover:bg-transparent">
                          <TableHead className="h-10 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Type</TableHead>
                          <TableHead className="h-10 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Score</TableHead>
                          <TableHead className="h-10 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Trace ID</TableHead>
                          <TableHead className="h-10 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">Feedback</TableHead>
                          <TableHead className="h-10 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider text-right">Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentRatings.map((entry) => (
                          <RatingRow 
                            key={entry.id} 
                            entry={entry} 
                            getEventDataValue={getEventDataValue}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Other Tabs */}
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

        <TabsContent value="analytics" className="mt-6">
          {selectedWebletId && <AnalyticsTab webletId={selectedWebletId} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
