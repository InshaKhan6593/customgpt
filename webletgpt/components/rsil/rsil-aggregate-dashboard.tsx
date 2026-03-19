"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  AreaChart,
  Area,
  RadarChart,
  Radar,
  RadialBarChart,
  RadialBar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  CartesianGrid,
  XAxis,
  YAxis,
  Label,
  LineChart,
  Line,
} from "recharts"
import {
  Bot,
  TrendingUp,
  FlaskConical,
  Sparkles,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Minus,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { cn, displayScore } from "@/lib/utils"

export interface AggregateData {
  weblets: Array<{
    id: string
    name: string
    slug: string
    rsilEnabled: boolean
  }>
  aggregateStats: {
    totalWeblets: number
    totalInteractions: number
    avgCompositeScore: number
  }
  perWebletScores: Array<{
    webletId: string
    webletName: string
    compositeScore: number
    dimensions: Array<{ name: string; avgValue: number; sampleSize: number; weight: number }>
    interactionCount: number
    decision: "NONE" | "SUGGESTION" | "AUTO_UPDATE"
  }>
  activeABTestCount?: number
  optimizations30dCount?: number
  trendData?: Array<{ date: string; score: number }>
  optimizationActivity?: Array<{ week: string; count: number }>
}

interface RSILAggregateDashboardProps {
  data: AggregateData | null
  loading: boolean
  onSelectWeblet: (id: string) => void
}

export function RSILAggregateDashboard({ data, loading, onSelectWeblet }: RSILAggregateDashboardProps) {
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null)
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d")

  const activeTestsCount = useMemo(() => {
    return data?.activeABTestCount ?? data?.perWebletScores.filter((w) => w.decision === "SUGGESTION").length ?? 0
  }, [data])

  const optimizationsCount = useMemo(() => {
    return data?.optimizations30dCount ?? data?.perWebletScores.filter((w) => w.decision === "AUTO_UPDATE").length ?? 0
  }, [data])

  const sortedWeblets = useMemo(() => {
    if (!data?.perWebletScores) return []
    const list = [...data.perWebletScores]
    if (sortOrder === "asc") {
      list.sort((a, b) => a.compositeScore - b.compositeScore)
    } else if (sortOrder === "desc") {
      list.sort((a, b) => b.compositeScore - a.compositeScore)
    }
    return list
  }, [data, sortOrder])

  const toggleSort = () => {
    if (sortOrder === null) setSortOrder("desc")
    else if (sortOrder === "desc") setSortOrder("asc")
    else setSortOrder(null)
  }

  const filteredTrend = useMemo(() => {
    if (!data?.trendData?.length) return []
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return data.trendData
      .filter(p => new Date(p.date) >= cutoff)
      .map(p => ({ 
        date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), 
        composite: displayScore(p.score) 
      }))
  }, [data, timeRange])

  const rawTrendData = useMemo(() => {
    if (!data?.trendData?.length) return []
    return data.trendData.map(p => ({
      date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), 
      composite: displayScore(p.score) 
    }))
  }, [data])

  const radarData = useMemo(() => {
    if (!data?.perWebletScores.length) return []
    const dimSums: Record<string, { total: number; count: number }> = {}
    data.perWebletScores.forEach((w) => {
      w.dimensions.forEach((d) => {
        if (!dimSums[d.name]) dimSums[d.name] = { total: 0, count: 0 }
        dimSums[d.name].total += d.avgValue
        dimSums[d.name].count += 1
      })
    })
    return Object.entries(dimSums).map(([name, { total, count }]) => ({
      dimension: name.charAt(0).toUpperCase() + name.slice(1),
      score: displayScore(total / count),
    }))
  }, [data])

  const radialData = useMemo(() => {
    if (!data?.aggregateStats) return []
    return [{
      name: "Composite",
      score: displayScore(data.aggregateStats.avgCompositeScore),
      fill: "var(--chart-1)"
    }]
  }, [data])

  const areaConfig = {
    composite: { label: "Composite Score", color: "var(--chart-1)" },
  } satisfies ChartConfig

  const radarConfig = {
    score: { label: "Score", color: "var(--chart-1)" },
  } satisfies ChartConfig

  const radialConfig = {
    score: { label: "Score", color: "var(--chart-1)" },
  } satisfies ChartConfig

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const { aggregateStats } = data
  const displayedAvgScore = displayScore(aggregateStats.avgCompositeScore)

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">RSIL Overview</h1>
        <p className="text-muted-foreground mt-1">Self-improving prompt optimization across all weblets</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6 @container">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weblets</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{aggregateStats.totalWeblets}</div>
              <p className="text-xs text-muted-foreground">
                {data.weblets.filter((w) => w.rsilEnabled).length} enabled / {data.weblets.length} total
              </p>
              <ChartContainer config={areaConfig} className="h-8 w-full mt-3 opacity-50">
                <LineChart data={rawTrendData}>
                  <Line type="monotone" dataKey="composite" stroke="var(--color-composite)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Composite Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "text-3xl font-bold tracking-tight",
                  displayedAvgScore >= 7.0 ? "text-green-600" :
                  displayedAvgScore >= 4.0 ? "text-yellow-600" : "text-red-600"
                )}
              >
                {displayedAvgScore}
              </div>
              <p className="text-xs text-muted-foreground">Across all optimized weblets</p>
              <ChartContainer config={areaConfig} className="h-8 w-full mt-3 opacity-50">
                <LineChart data={rawTrendData}>
                  <Line type="monotone" dataKey="composite" stroke="var(--color-composite)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active A/B Tests</CardTitle>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{activeTestsCount}</div>
              <p className="text-xs text-muted-foreground">{activeTestsCount} running</p>
              <ChartContainer config={areaConfig} className="h-8 w-full mt-3 opacity-50">
                <LineChart data={rawTrendData}>
                  <Line type="monotone" dataKey="composite" stroke="var(--color-composite)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Optimizations (30d)</CardTitle>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{optimizationsCount}</div>
              <p className="text-xs text-muted-foreground">{optimizationsCount} this month</p>
              <ChartContainer config={areaConfig} className="h-8 w-full mt-3 opacity-50">
                <LineChart data={rawTrendData}>
                  <Line type="monotone" dataKey="composite" stroke="var(--color-composite)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Score Trends</CardTitle>
              <CardDescription>Rolling composite score history</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={timeRange === "7d" ? "secondary" : "ghost"} size="sm" onClick={() => setTimeRange("7d")}>7d</Button>
              <Button variant={timeRange === "30d" ? "secondary" : "ghost"} size="sm" onClick={() => setTimeRange("30d")}>30d</Button>
              <Button variant={timeRange === "90d" ? "secondary" : "ghost"} size="sm" onClick={() => setTimeRange("90d")}>90d</Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {filteredTrend.length > 0 ? (
              <ChartContainer config={areaConfig} className="h-[300px] w-full">
                <AreaChart data={filteredTrend}>
                  <defs>
                    <linearGradient id="colorComposite" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-composite)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-composite)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="composite" stroke="var(--color-composite)" fill="url(#colorComposite)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                Historical trend data not yet available for this period
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Dimension Breakdown</CardTitle>
            <CardDescription>Aggregate performance across evaluation dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ChartContainer config={radarConfig} className="h-[300px] w-full">
                <RadarChart data={radarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <PolarGrid gridType="polygon" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <Radar name="Score" dataKey="score" stroke="var(--color-score)" fill="var(--color-score)" fillOpacity={0.4} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                </RadarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No dimension data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Composite Gauge</CardTitle>
            <CardDescription>Overall quality score</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radialConfig} className="h-[300px] w-full">
              <RadialBarChart data={radialData} innerRadius={90} outerRadius={140} startAngle={90} endAngle={-270}>
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
                <RadialBar dataKey="score" cornerRadius={10} fill="var(--color-score)" />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-5xl font-bold">
                  {displayedAvgScore.toFixed(1)}
                </text>
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Weblet Health</CardTitle>
            <CardDescription>Detailed overview of all tracked weblets</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedWeblets.length === 0 ? (
              <div className="py-8 text-sm text-muted-foreground text-center">
                No RSIL weblets found.
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Weblet</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={toggleSort}
                      >
                        <div className="flex items-center gap-1">
                          Score
                          <ArrowUpDown className="size-3" />
                        </div>
                      </TableHead>
                      <TableHead>Trend</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Interactions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWeblets.map((weblet) => {
                      const score = displayScore(weblet.compositeScore)
                      let scoreColor = "text-red-600"
                      if (score >= 7.0) scoreColor = "text-green-600"
                      else if (score >= 4.0) scoreColor = "text-yellow-600"

                      let statusLabel = "Healthy"
                      let statusColor = "bg-green-500/10 text-green-700 hover:bg-green-500/20"
                      if (weblet.decision === "AUTO_UPDATE") {
                        statusLabel = "Optimizing"
                        statusColor = "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
                      } else if (weblet.decision === "SUGGESTION") {
                        statusLabel = "Needs Improvement"
                        statusColor = "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                      } else if (weblet.interactionCount === 0) {
                        statusLabel = "Idle"
                        statusColor = "bg-muted text-muted-foreground hover:bg-muted/80"
                      }

                      const trendPoints = data?.trendData ?? []
                      const TrendIcon = trendPoints.length >= 2
                        ? (trendPoints[trendPoints.length - 1].score > trendPoints[trendPoints.length - 2].score ? ArrowUp :
                           trendPoints[trendPoints.length - 1].score < trendPoints[trendPoints.length - 2].score ? ArrowDown : ArrowRight)
                        : Minus
                      const trendColor = trendPoints.length >= 2
                        ? (trendPoints[trendPoints.length - 1].score > trendPoints[trendPoints.length - 2].score ? "text-green-600" :
                           trendPoints[trendPoints.length - 1].score < trendPoints[trendPoints.length - 2].score ? "text-red-600" : "text-yellow-600")
                        : "text-muted-foreground"

                      return (
                        <TableRow
                          key={weblet.webletId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => onSelectWeblet(weblet.webletId)}
                        >
                          <TableCell className="font-medium">{weblet.webletName}</TableCell>
                          <TableCell className={cn("font-bold tabular-nums", scoreColor)}>
                            {score.toFixed(1)}
                          </TableCell>
                          <TableCell>
                            <TrendIcon className={cn("size-4", trendColor)} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={cn("border-transparent", statusColor)}>
                              {statusLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {weblet.interactionCount}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectWeblet(weblet.webletId)
                              }}
                            >
                              View Details
                            </Button>
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
      </motion.div>
    </div>
  )
}
