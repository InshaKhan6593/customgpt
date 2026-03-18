"use client"

import * as React from "react"
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, ReferenceArea } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { PerformanceTrendPoint } from "./types"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function formatDimensionLabel(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function detectScoreKeys(trend: PerformanceTrendPoint[]): string[] {
  const keySet = new Set<string>()
  for (const point of trend) {
    for (const key of Object.keys(point)) {
      if (key !== "date" && key !== "composite" && typeof point[key] === "number") {
        keySet.add(key)
      }
    }
  }
  return Array.from(keySet)
}

function buildChartConfig(scoreKeys: string[]): ChartConfig {
  const config: ChartConfig = {
    composite: {
      label: "Composite Score",
      color: "var(--chart-1)",
    },
  }
  scoreKeys.forEach((key, i) => {
    config[key] = {
      label: formatDimensionLabel(key),
      color: CHART_COLORS[(i + 1) % CHART_COLORS.length],
    }
  })
  return config
}

interface PerformanceTrendChartProps {
  trend: PerformanceTrendPoint[]
  thresholds?: { none: number; suggestion: number }
}

export function PerformanceTrendChart({
  trend,
  thresholds = { none: 0.8, suggestion: 0.6 },
}: PerformanceTrendChartProps) {
  const scoreKeys = React.useMemo(() => {
    if (!trend || trend.length === 0) return []
    return detectScoreKeys(trend)
  }, [trend])

  const chartConfig = React.useMemo(() => buildChartConfig(scoreKeys), [scoreKeys])

  const allKeys = React.useMemo(() => ["composite", ...scoreKeys], [scoreKeys])

  const [visibleDimensions, setVisibleDimensions] = React.useState<Set<string>>(
    () => new Set(allKeys)
  )

  React.useEffect(() => {
    if (allKeys.length > 0 && visibleDimensions.size === 0) {
      setVisibleDimensions(new Set(allKeys))
    }
  }, [allKeys, visibleDimensions.size])

  const toggleDimension = React.useCallback((dim: string) => {
    setVisibleDimensions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(dim)) {
        newSet.delete(dim)
      } else {
        newSet.add(dim)
      }
      return newSet
    })
  }, [])

  const dateRange = React.useMemo(() => {
    if (!trend || trend.length === 0) return ""
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    return `${fmt(trend[0].date)} – ${fmt(trend[trend.length - 1].date)}`
  }, [trend])

  const isEmpty = !trend || trend.length === 0

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-base font-semibold">Performance Trend</CardTitle>
        <CardDescription className="text-xs">
          {isEmpty ? "Composite and dimension scores over time" : dateRange}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-5 sm:px-5">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground border-dashed border-border/50 rounded-md bg-transparent">
            Performance trend will appear here after your weblet receives conversations
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                fontSize={12}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis
                domain={[0, 1]}
                tickFormatter={(v: number) => v.toFixed(1)}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                fontSize={12}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <ReferenceArea y1={thresholds.none} y2={1.0} fill="oklch(0.723 0.219 142.18)" fillOpacity={0.05} />
              <ReferenceArea y1={thresholds.suggestion} y2={thresholds.none} fill="oklch(0.795 0.184 86.05)" fillOpacity={0.05} />
              <ReferenceArea y1={0} y2={thresholds.suggestion} fill="oklch(0.637 0.237 25.33)" fillOpacity={0.05} />
              {scoreKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartConfig[key].color}
                  fill={chartConfig[key].color}
                  fillOpacity={0}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={!visibleDimensions.has(key)}
                />
              ))}
              <Area
                key="composite"
                type="monotone"
                dataKey="composite"
                stroke={chartConfig.composite.color}
                fill={chartConfig.composite.color}
                fillOpacity={0.1}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
                hide={!visibleDimensions.has("composite")}
              />
              <ChartLegend
                content={
                  <ChartLegendContent
                    onClick={(payload) => {
                      if (payload && "dataKey" in payload && typeof payload.dataKey === "string") {
                        toggleDimension(payload.dataKey)
                      }
                    }}
                  />
                }
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
