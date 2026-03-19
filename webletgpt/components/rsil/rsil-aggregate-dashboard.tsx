"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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
import { cn } from "@/lib/utils"

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

  const lineChartConfig = useMemo((): ChartConfig => ({
    composite: { label: "Composite Score", color: "var(--chart-1)" },
  }), [])

  const trendData = useMemo(() => {
    if (!data?.trendData?.length) return []
    return data.trendData.map((point) => ({
      date: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      composite: parseFloat((point.score * 10).toFixed(1)),
    }))
  }, [data])

  const dimensionChartConfig = useMemo(() => {
    const config: ChartConfig = {}
    data?.perWebletScores.forEach((w, i) => {
      config[w.webletId] = {
        label: w.webletName,
        color: `var(--chart-${(i % 5) + 1})`,
      }
    })
    return config
  }, [data])

  const dimensionData = useMemo(() => {
    if (!data?.perWebletScores.length) return []
    const dimNames = new Set<string>()
    data.perWebletScores.forEach((w) => w.dimensions.forEach((d) => dimNames.add(d.name)))
    
    return Array.from(dimNames).map((dim) => {
      const row: Record<string, string | number> = { 
        name: dim.charAt(0).toUpperCase() + dim.slice(1) 
      }
      data.perWebletScores.forEach((w) => {
        const dimObj = w.dimensions.find((d) => d.name === dim)
        row[w.webletId] = dimObj ? parseFloat((dimObj.avgValue * 10).toFixed(1)) : 0
      })
      return row
    })
  }, [data])

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
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const { aggregateStats } = data

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">RSIL Overview</h1>
        <p className="text-muted-foreground mt-1">Self-improving prompt optimization across all weblets</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
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
                  aggregateStats.avgCompositeScore >= 0.7 ? "text-green-600" :
                  aggregateStats.avgCompositeScore >= 0.4 ? "text-yellow-600" : "text-red-600"
                )}
              >
                {(aggregateStats.avgCompositeScore * 10).toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">Across all optimized weblets</p>
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
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Score Trends</CardTitle>
            <CardDescription>7-day rolling composite score</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ChartContainer config={lineChartConfig} className="h-[250px] w-full">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="composite" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                Historical trend data not yet available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Dimension Performance</CardTitle>
            <CardDescription>Average scores across measured dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            {dimensionData.length > 0 ? (
              <ChartContainer config={dimensionChartConfig} className="h-[250px] w-full">
                <BarChart data={dimensionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <YAxis domain={[0, 10]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {data.perWebletScores.map((w, i) => (
                    <Bar
                      key={w.webletId}
                      dataKey={w.webletId}
                      fill={`var(--chart-${(i % 5) + 1})`}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                No dimension data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Optimization Activity</CardTitle>
            <CardDescription>Weekly prompt update frequency</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.optimizationActivity?.some(a => a.count > 0) ? (
              <ChartContainer config={{ count: { label: "Optimizations", color: "var(--chart-2)" } }} className="h-[200px] w-full">
                <BarChart data={data.optimizationActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[200px] w-full items-center justify-center text-sm text-muted-foreground rounded-md border border-dashed">
                No optimization activity yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                    <TableHead>Last Optimized</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedWeblets.map((weblet) => {
                    const score = weblet.compositeScore
                    let scoreColor = "text-red-600"
                    if (score >= 0.7) scoreColor = "text-green-600"
                    else if (score >= 0.4) scoreColor = "text-yellow-600"

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

                    const lastOptimized = "N/A"

                    return (
                      <TableRow
                        key={weblet.webletId}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => onSelectWeblet(weblet.webletId)}
                      >
                        <TableCell className="font-medium">{weblet.webletName}</TableCell>
                        <TableCell className={cn("font-bold tabular-nums", scoreColor)}>
                          {(score * 10).toFixed(1)}
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
                          {lastOptimized}
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
    </div>
  )
}
