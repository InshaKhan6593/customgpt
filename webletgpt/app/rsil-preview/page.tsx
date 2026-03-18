"use client"

import { useState } from "react"
import { 
  ArrowLeft, 
  Sparkles, 
  BarChart3, 
  Activity, 
  Zap, 
  TrendingUp,
  Clock,
  ChevronRight,
  GitBranch,
  Shield,
  FlaskConical
} from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Mock data for preview
const mockTimeSeries = [
  { date: "Mar 1", relevance: 0.72, accuracy: 0.68, coherence: 0.81, helpfulness: 0.75 },
  { date: "Mar 5", relevance: 0.75, accuracy: 0.71, coherence: 0.79, helpfulness: 0.78 },
  { date: "Mar 10", relevance: 0.78, accuracy: 0.74, coherence: 0.83, helpfulness: 0.80 },
  { date: "Mar 15", relevance: 0.82, accuracy: 0.79, coherence: 0.85, helpfulness: 0.84 },
  { date: "Mar 19", relevance: 0.85, accuracy: 0.82, coherence: 0.88, helpfulness: 0.87 },
]

const mockDimensions = [
  { name: "relevance", avg: 0.85, samples: 142, isWeak: false, p50: 0.84, p90: 0.92 },
  { name: "accuracy", avg: 0.82, samples: 142, isWeak: false, p50: 0.81, p90: 0.89 },
  { name: "coherence", avg: 0.88, samples: 142, isWeak: false, p50: 0.87, p90: 0.94 },
  { name: "helpfulness", avg: 0.87, samples: 142, isWeak: false, p50: 0.86, p90: 0.93 },
  { name: "conciseness", avg: 0.62, samples: 142, isWeak: true, p50: 0.60, p90: 0.71 },
]

const mockRatings = [
  { id: "1", eventType: "thumbs_up", score: 1, traceId: "tr_a1b2c3d4e5", feedback: "Very helpful response!", createdAt: new Date().toISOString() },
  { id: "2", eventType: "thumbs_down", score: -1, traceId: "tr_f6g7h8i9j0", feedback: "Could be more concise", createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: "3", eventType: "thumbs_up", score: 1, traceId: "tr_k1l2m3n4o5", feedback: null, createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: "4", eventType: "thumbs_up", score: 1, traceId: "tr_p6q7r8s9t0", feedback: "Exactly what I needed", createdAt: new Date(Date.now() - 10800000).toISOString() },
]

const mockWeblets = [
  { id: "1", name: "Customer Support Bot", rsilEnabled: true },
  { id: "2", name: "Sales Assistant", rsilEnabled: true },
  { id: "3", name: "Technical Helper", rsilEnabled: false },
]

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

  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
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
                {dimensionNames.map((name) => (
                  <linearGradient key={name} id={`gradient-${name}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartConfig[name]?.color || '#171717'} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={chartConfig[name]?.color || '#171717'} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="hsl(var(--border))" 
                strokeOpacity={0.4} 
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                fontSize={11}
                tick={{ fill: "hsl(var(--muted-foreground))", opacity: 0.6 }}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(v) => v.toFixed(1)}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                fontSize={11}
                tick={{ fill: "hsl(var(--muted-foreground))", opacity: 0.6 }}
              />
              <ChartTooltip 
                content={<ChartTooltipContent indicator="line" />}
                cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }}
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
                  activeDot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/30">
          {dimensionNames.map((name, i) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <div 
                className="size-2 rounded-full" 
                style={{ backgroundColor: Object.values(CHART_COLORS)[i % 5] }}
              />
              <span className="text-muted-foreground/70 capitalize">{name}</span>
            </div>
          ))}
        </div>
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
      "border-border/40 bg-card/50 backdrop-blur-sm transition-all duration-200 hover:border-border/60 hover:bg-card/60",
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

// Premium Stat Card
function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend
}: { 
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: { value: number; label: string }
}) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</span>
              {trend && (
                <span className={cn(
                  "text-xs font-medium",
                  trend.value >= 0 ? "text-emerald-600" : "text-rose-500"
                )}>
                  {trend.value >= 0 ? "+" : ""}{trend.value}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground/60">{description}</p>
            )}
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <Icon className="size-4 text-muted-foreground/60" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function RSILDashboardPreview() {
  const [selectedWeblet, setSelectedWeblet] = useState(mockWeblets[0])
  const [rsilEnabled, setRsilEnabled] = useState(true)
  const [activeTab, setActiveTab] = useState("scores")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto">
          <div className="flex h-14 items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground/70 hover:text-foreground">
                <ArrowLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground/60">Dashboard</span>
                <ChevronRight className="size-3.5 text-muted-foreground/40" />
                <span className="font-medium text-foreground">RSIL</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Response Self-Improvement Loop
              </h1>
              <p className="text-sm text-muted-foreground/70">
                Monitor and optimize your AI response quality with automated feedback analysis
              </p>
            </div>
            <Button 
              className="gap-2 bg-foreground text-background hover:bg-foreground/90"
              size="sm"
            >
              <Sparkles className="size-3.5" />
              Optimize Prompt
            </Button>
          </div>

          {/* Weblet Selector & Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <Select 
                value={selectedWeblet.id} 
                onValueChange={(id) => setSelectedWeblet(mockWeblets.find(w => w.id === id) || mockWeblets[0])}
              >
                <SelectTrigger className="w-[240px] border-border/40 bg-background/50">
                  <SelectValue placeholder="Select a weblet" />
                </SelectTrigger>
                <SelectContent>
                  {mockWeblets.map((weblet) => (
                    <SelectItem key={weblet.id} value={weblet.id}>
                      <div className="flex items-center gap-2">
                        <span>{weblet.name}</span>
                        {weblet.rsilEnabled && (
                          <div className="size-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-xs border-border/40 text-muted-foreground/70">
                v2.4.1 Active
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground/70">RSIL Enabled</span>
              <Switch 
                checked={rsilEnabled} 
                onCheckedChange={setRsilEnabled}
              />
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Overall Score"
            value="8.4"
            description="Last 7 days"
            icon={TrendingUp}
            trend={{ value: 5.2, label: "vs last period" }}
          />
          <StatCard 
            title="Total Ratings"
            value="142"
            description="Last 7 days"
            icon={BarChart3}
            trend={{ value: 12.3, label: "vs last period" }}
          />
          <StatCard 
            title="Positive Rate"
            value="89%"
            description="Thumbs up ratio"
            icon={Zap}
            trend={{ value: 3.1, label: "vs last period" }}
          />
          <StatCard 
            title="Avg Response"
            value="1.2s"
            description="P50 latency"
            icon={Clock}
            trend={{ value: -8.4, label: "vs last period" }}
          />
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-10 p-1 bg-muted/30 border border-border/40">
            <TabsTrigger value="scores" className="gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BarChart3 className="size-3.5" />
              Scores
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Activity className="size-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="versions" className="gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <GitBranch className="size-3.5" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="abtest" className="gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FlaskConical className="size-3.5" />
              A/B Test
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Shield className="size-3.5" />
              Governance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scores" className="space-y-6 mt-0">
            {/* Performance Chart */}
            <PremiumPerformanceChart 
              timeSeries={mockTimeSeries}
              dimensionNames={["relevance", "accuracy", "coherence", "helpfulness"]}
            />

            {/* Score Dimension Cards */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Score Dimensions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {mockDimensions.map((dim) => (
                  <ScoreDimensionCard
                    key={dim.name}
                    name={dim.name}
                    avgValue={dim.avg}
                    sampleSize={dim.samples}
                    isWeak={dim.isWeak}
                    p50={dim.p50}
                    p90={dim.p90}
                  />
                ))}
              </div>
            </div>

            {/* Recent Ratings Table */}
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium text-foreground">Recent Ratings</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground/70">Latest user feedback and scores</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground/70 hover:text-foreground">
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/30 hover:bg-transparent">
                      <TableHead className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider h-9">Type</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider h-9">Score</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider h-9">Trace ID</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider h-9">Feedback</TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider h-9 text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockRatings.map((rating) => (
                      <TableRow key={rating.id} className="hover:bg-muted/5 border-border/30">
                        <TableCell className="py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium h-5 px-2 uppercase tracking-wide border-0",
                              rating.eventType === "thumbs_up" && "bg-emerald-500/10 text-emerald-600",
                              rating.eventType === "thumbs_down" && "bg-rose-500/10 text-rose-500"
                            )}
                          >
                            {rating.eventType.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 font-medium text-sm tabular-nums text-foreground/80">
                          {rating.eventType === "thumbs_up" ? "+" : "-"}
                        </TableCell>
                        <TableCell className="py-3 font-mono text-xs text-muted-foreground/60 max-w-[160px] truncate">
                          {rating.traceId}
                        </TableCell>
                        <TableCell className="py-3 max-w-[240px] truncate text-sm text-muted-foreground/70">
                          {rating.feedback || "-"}
                        </TableCell>
                        <TableCell className="py-3 text-right text-xs text-muted-foreground/50 whitespace-nowrap">
                          {new Date(rating.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-0">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex items-center justify-center h-[400px] text-sm text-muted-foreground/60">
                Analytics content would go here
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="versions" className="mt-0">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex items-center justify-center h-[400px] text-sm text-muted-foreground/60">
                Version history content would go here
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="abtest" className="mt-0">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex items-center justify-center h-[400px] text-sm text-muted-foreground/60">
                A/B Test content would go here
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="governance" className="mt-0">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex items-center justify-center h-[400px] text-sm text-muted-foreground/60">
                Governance content would go here
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
