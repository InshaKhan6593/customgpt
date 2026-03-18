"use client"

import * as React from "react"
import { AreaChart, Area, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from "@/components/ui/chart"
import type { ScoreTimeSeries } from "./types"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

interface PerformanceChartProps {
  timeSeries: Array<ScoreTimeSeries & { date: string }>
  dimensionNames: string[]
}

function formatDimensionLabel(name: string): string {
  return name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function detectScoreKeys(
  timeSeries: Array<ScoreTimeSeries & { date: string }>,
  dimensionNames: string[]
): string[] {
  if (dimensionNames.length > 0) return dimensionNames

  const keySet = new Set<string>()
  for (const point of timeSeries) {
    for (const key of Object.keys(point)) {
      if (key !== "date" && !key.endsWith("_count")) {
        keySet.add(key)
      }
    }
  }
  return Array.from(keySet)
}

function buildChartConfig(scoreKeys: string[]): ChartConfig {
  const config: ChartConfig = {}
  scoreKeys.forEach((key, i) => {
    config[key] = {
      label: formatDimensionLabel(key),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }
  })
  return config
}

export function PerformanceChart({ timeSeries, dimensionNames }: PerformanceChartProps) {
  const scoreKeys = React.useMemo(() => {
    if (!timeSeries || timeSeries.length === 0) return []
    return detectScoreKeys(timeSeries, dimensionNames)
  }, [timeSeries, dimensionNames])

  const chartConfig = React.useMemo(() => buildChartConfig(scoreKeys), [scoreKeys])

  const [visibleDimensions, setVisibleDimensions] = React.useState<Set<string>>(() => new Set(scoreKeys))

  React.useEffect(() => {
    if (scoreKeys.length > 0 && visibleDimensions.size === 0) {
      setVisibleDimensions(new Set(scoreKeys))
    }
  }, [scoreKeys, visibleDimensions.size])

  const toggleDimension = React.useCallback((dim: string) => {
    setVisibleDimensions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dim)) {
        newSet.delete(dim)
      } else {
        newSet.add(dim)
      }
      return newSet
    })
  }, [])

  const isEmpty = !timeSeries || timeSeries.length === 0

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-base font-semibold">Performance Over Time</CardTitle>
        <CardDescription className="text-xs">Score dimensions over time</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-5 sm:px-5">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground border-dashed border-border/50 rounded-md bg-transparent">
            Score data will appear here after your weblet receives conversations
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                tickFormatter={(v) => v.toFixed(1)}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                fontSize={12}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
              <ChartLegend 
                content={
                  <ChartLegendContent 
                    onClick={(payload) => {
                      if (payload && 'dataKey' in payload && typeof payload.dataKey === 'string') {
                        toggleDimension(payload.dataKey)
                      }
                    }} 
                  />
                } 
              />
              {scoreKeys.map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartConfig[key].color}
                  fill={chartConfig[key].color}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  hide={!visibleDimensions.has(key)}
                />
              ))}
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
