"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { WebletSelector } from "@/components/rsil/weblet-selector"
import { RSILOverview } from "@/components/rsil/rsil-overview"
import { PerformanceChart } from "@/components/rsil/performance-chart"
import { AbTestStatus } from "@/components/rsil/ab-test-status"
import { VersionHistory } from "@/components/rsil/version-history"
import { GovernanceConfigForm } from "@/components/rsil/governance-config"
import { OptimizeToggle } from "@/components/rsil/optimize-toggle"
import { RsilEmptyState } from "@/components/rsil/rsil-empty-state"
import { OptimizationLog } from "@/components/rsil/optimization-log"

import type {
  AnalysisResult,
  GovernanceConfig,
  TestResult,
  WebletOverview,
  WebletVersion,
  RatingEntry,
} from "@/components/rsil/types"

type OverviewResponse = {
  weblets: WebletOverview[]
}

type ScoresResponse = {
  analysis: AnalysisResult
  rawScores: Array<{
    timestamp: string
    composite: number
    helpfulness: number
    correctness: number
    coherence: number
    safety: number
  }>
  recentRatings: RatingEntry[]
}

type TestsResponse = {
  evaluation: TestResult | null
  testingVersion: WebletVersion | null
}

type ConfigResponse = {
  rsilEnabled: boolean
  governance: GovernanceConfig
}

type VersionsResponse = {
  versions: WebletVersion[]
}

export default function RSILDashboardPage() {
  const [weblets, setWeblets] = useState<WebletOverview[]>([])
  const [selectedWebletId, setSelectedWebletId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")

  const [overviewLoading, setOverviewLoading] = useState(true)
  const [scoresLoading, setScoresLoading] = useState(false)
  const [testsLoading, setTestsLoading] = useState(false)
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [rawScores, setRawScores] = useState<ScoresResponse["rawScores"]>([])
  const [recentRatings, setRecentRatings] = useState<RatingEntry[]>([])
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testingVersion, setTestingVersion] = useState<WebletVersion | null>(null)
  const [versions, setVersions] = useState<WebletVersion[]>([])
  const [rsilEnabled, setRsilEnabled] = useState(false)
  const [governance, setGovernance] = useState<GovernanceConfig | null>(null)

  const selectedWeblet = weblets.find((w) => w.id === selectedWebletId)

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const res = await fetch("/api/rsil/overview")
      if (!res.ok) throw new Error("Failed to load RSIL overview")
      const data: OverviewResponse = await res.json()
      setWeblets(data.weblets)
      if (data.weblets.length > 0 && !selectedWebletId) {
        setSelectedWebletId(data.weblets[0].id)
      }
    } catch {
      toast.error("Failed to load RSIL data")
    } finally {
      setOverviewLoading(false)
    }
  }, [selectedWebletId])

  const fetchScores = useCallback(async (webletId: string) => {
    setScoresLoading(true)
    try {
      const res = await fetch(`/api/rsil/scores?webletId=${webletId}&hours=168`)
      if (!res.ok) throw new Error("Failed to load scores")
      const data: ScoresResponse = await res.json()
      setAnalysis(data.analysis)
      setRawScores(data.rawScores || [])
      setRecentRatings(data.recentRatings || [])
    } catch {
      setAnalysis(null)
      setRawScores([])
      setRecentRatings([])
    } finally {
      setScoresLoading(false)
    }
  }, [])

  const fetchTests = useCallback(async (webletId: string) => {
    setTestsLoading(true)
    try {
      const res = await fetch(`/api/rsil/tests?webletId=${webletId}`)
      if (!res.ok) throw new Error("Failed to load tests")
      const data: TestsResponse = await res.json()
      setTestResult(data.evaluation)
      setTestingVersion(data.testingVersion)
    } catch {
      setTestResult(null)
      setTestingVersion(null)
    } finally {
      setTestsLoading(false)
    }
  }, [])

  const fetchVersions = useCallback(async (webletId: string) => {
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/rsil/versions?webletId=${webletId}`)
      if (!res.ok) throw new Error("Failed to load versions")
      const data: VersionsResponse = await res.json()
      setVersions(data.versions || [])
    } catch {
      setVersions([])
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  const fetchConfig = useCallback(async (webletId: string) => {
    setConfigLoading(true)
    try {
      const res = await fetch(`/api/rsil/config?webletId=${webletId}`)
      if (!res.ok) throw new Error("Failed to load config")
      const data: ConfigResponse = await res.json()
      setRsilEnabled(data.rsilEnabled)
      setGovernance(data.governance)
    } catch {
      setRsilEnabled(false)
      setGovernance(null)
    } finally {
      setConfigLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  useEffect(() => {
    if (!selectedWebletId) return
    fetchScores(selectedWebletId)
    fetchTests(selectedWebletId)
    fetchVersions(selectedWebletId)
    fetchConfig(selectedWebletId)
  }, [selectedWebletId, fetchScores, fetchTests, fetchVersions, fetchConfig])

  function handleWebletChange(id: string) {
    setSelectedWebletId(id)
    setActiveTab("overview")
    setAnalysis(null)
    setRawScores([])
    setRecentRatings([])
    setTestResult(null)
    setTestingVersion(null)
    setVersions([])
    setGovernance(null)
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
    } catch {
      toast.error("Failed to toggle RSIL")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRunOptimization() {
    if (!selectedWebletId) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/rsil/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId }),
      })
      if (!res.ok) throw new Error("Failed to run")
      const data = await res.json()
      if (data.skipped) {
        toast.warning(data.reason || "Optimization skipped — governance check failed")
      } else if (data.action === "ab_test_started") {
        toast.success("Optimization started — A/B test created")
        setTimeout(() => {
          if (selectedWebletId) {
            fetchScores(selectedWebletId)
            fetchTests(selectedWebletId)
            fetchVersions(selectedWebletId)
          }
        }, 3000)
      } else if (data.action === "suggestion") {
        toast.info(data.analysis?.reason || "Suggestion generated — review in Scores tab")
      } else if (data.action === "none") {
        toast.info(data.analysis?.reason || "Not enough score data yet — keep collecting user feedback")
      } else {
        toast.info("Optimization completed — no changes needed")
      }
    } catch {
      toast.error("Failed to start optimization")
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePromoteTest() {
    if (!selectedWebletId) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/rsil/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, action: "promote" }),
      })
      if (!res.ok) throw new Error("Failed to promote")
      toast.success("Variant promoted successfully")
      fetchTests(selectedWebletId)
      fetchVersions(selectedWebletId)
      fetchScores(selectedWebletId)
      fetchOverview()
    } catch {
      toast.error("Failed to promote variant")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEndTest() {
    if (!selectedWebletId) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/rsil/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, action: "end" }),
      })
      if (!res.ok) throw new Error("Failed to end test")
      toast.success("Test ended, control version kept")
      fetchTests(selectedWebletId)
      fetchVersions(selectedWebletId)
      fetchOverview()
    } catch {
      toast.error("Failed to end test")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSaveGovernance(config: GovernanceConfig) {
    if (!selectedWebletId) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/rsil/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, governance: config }),
      })
      if (!res.ok) throw new Error("Failed to save")
      setGovernance(config)
      toast.success("Governance settings saved")
    } catch {
      toast.error("Failed to save governance settings")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRollback(versionId: string) {
    if (!selectedWebletId) return
    setActionLoading(true)
    try {
      const res = await fetch("/api/rsil/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId: selectedWebletId, targetVersionId: versionId }),
      })
      if (!res.ok) throw new Error("Failed to rollback")
      toast.success("Rollback successful")
      fetchVersions(selectedWebletId)
      fetchScores(selectedWebletId)
      fetchOverview()
    } catch {
      toast.error("Failed to rollback version")
    } finally {
      setActionLoading(false)
    }
  }

  if (overviewLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  if (weblets.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="size-6" />
            RSIL — Self-Improving AI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reinforcement from System &amp; Instructions Learning
          </p>
        </div>
        <RsilEmptyState />
      </div>
    )
  }

  const currentVersionId = selectedWeblet?.latestVersion?.id ?? ""
  const currentVersionNum = selectedWeblet?.latestVersion?.versionNum ?? 1
  const hasActiveTest = !!selectedWeblet?.activeTest
  const totalVersions = selectedWeblet?.totalVersions ?? 0
  const controlVersion = versions.find((v) => v.status === "ACTIVE" && v.id === currentVersionId) ?? null

  function getEventDataValue(eventData: Record<string, unknown> | null, keys: string[]) {
    if (!eventData) return null

    for (const key of keys) {
      const value = eventData[key]
      if (typeof value === "string" && value.trim().length > 0) return value
      if (typeof value === "number") return value
    }

    return null
  }

  const chartData = rawScores.map((s) => ({
    date: new Date(s.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    composite: s.composite,
    helpfulness: s.helpfulness,
    correctness: s.correctness,
    coherence: s.coherence,
    safety: s.safety,
  }))

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="size-6" />
              RSIL — Self-Improving AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Reinforcement from System &amp; Instructions Learning
            </p>
          </div>
          <div className="flex items-center gap-3">
            <WebletSelector
              weblets={weblets}
              selectedId={selectedWebletId}
              onSelect={handleWebletChange}
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
      </motion.div>

      <OptimizeToggle
        rsilEnabled={rsilEnabled}
        onToggle={handleToggleRSIL}
        onRunNow={handleRunOptimization}
        isActionLoading={actionLoading}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="tests">A/B Tests</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <RSILOverview
            analysis={analysis}
            latestVersion={selectedWeblet?.latestVersion ?? null}
            totalVersions={totalVersions}
            hasActiveTest={hasActiveTest}
            interactionCount={selectedWeblet?.interactionCount ?? 0}
            loading={scoresLoading}
          />

          <PerformanceChart
            data={chartData}
            dimensions={analysis?.dimensions ?? []}
          />

          <OptimizationLog versions={versions} loading={versionsLoading} />
        </TabsContent>

        <TabsContent value="scores" className="mt-4 space-y-6">
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
            <>
              {analysis?.dimensions && analysis.dimensions.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {analysis.dimensions.map((dim) => {
                    const isWeak = analysis.weakDimensions.includes(dim.name)
                    return (
                      <motion.div
                        key={dim.name}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25 }}
                      >
                        <Card className={cn(isWeak && "border-amber-500/30 bg-amber-500/5")}>
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground capitalize">{dim.name}</CardTitle>
                            {isWeak && (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-xs">
                                Needs Improvement
                              </Badge>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-bold text-foreground">{dim.avgValue.toFixed(1)}</span>
                              <span className="text-sm text-muted-foreground">/ 10</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {dim.sampleSize} samples · weight {dim.weight}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                  No dimension scores available yet.
                </div>
              )}

              <PerformanceChart
                data={chartData}
                dimensions={analysis?.dimensions ?? []}
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Recent Ratings</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentRatings.length === 0 ? (
                    <div className="py-8 text-sm text-muted-foreground text-center">
                      No individual ratings in this time range yet.
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Trace ID</TableHead>
                            <TableHead>Feedback</TableHead>
                            <TableHead className="text-right">Timestamp</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentRatings.map((entry) => {
                            const numericScore = getEventDataValue(entry.eventData, ["score", "rating", "value"])
                            const traceId = getEventDataValue(entry.eventData, ["traceId", "langfuseTraceId", "trace_id", "sessionTraceId"])
                            const feedback = getEventDataValue(entry.eventData, ["feedback", "comment", "reason", "notes"])

                            return (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "uppercase tracking-wide",
                                      entry.eventType === "thumbs_up" && "text-emerald-500 border-emerald-500/30",
                                      entry.eventType === "thumbs_down" && "text-rose-500 border-rose-500/30"
                                    )}
                                  >
                                    {entry.eventType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {typeof numericScore === "number"
                                    ? numericScore
                                    : entry.eventType === "thumbs_up"
                                      ? "👍"
                                      : entry.eventType === "thumbs_down"
                                        ? "👎"
                                        : "-"}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground max-w-[180px] truncate">
                                  {typeof traceId === "string" ? traceId : "-"}
                                </TableCell>
                                <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground">
                                  {typeof feedback === "string" ? feedback : "-"}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
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
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="tests" className="mt-4 space-y-6">
          {testsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 rounded-xl" />
            </div>
          ) : (
            <>
              <AbTestStatus
                testResult={testResult}
                controlVersion={controlVersion}
                testingVersion={testingVersion}
                currentVersionNum={currentVersionNum}
                onPromote={handlePromoteTest}
                onEnd={handleEndTest}
                onRunOptimization={handleRunOptimization}
                isActionLoading={actionLoading}
              />

              {versions.filter((v) => v.isAbTest && v.abTestEndedAt).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Test History</h3>
                    <VersionHistory
                      versions={versions.filter((v) => v.isAbTest)}
                      currentVersionId={currentVersionId}
                      onRollback={handleRollback}
                      isActionLoading={actionLoading}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          {versionsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <VersionHistory
              versions={versions}
              currentVersionId={currentVersionId}
              onRollback={handleRollback}
              isActionLoading={actionLoading}
            />
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-6">
          {configLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
          ) : (
            <>
              <GovernanceConfigForm
                initialConfig={governance}
                onSave={handleSaveGovernance}
                isSaving={actionLoading}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
