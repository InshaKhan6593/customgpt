"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import type { ScoreTimeSeries } from "./types"

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
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

  // Auto-detect from timeSeries keys (exclude date and _count suffixes)
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

function detectYDomain(
  timeSeries: Array<ScoreTimeSeries & { date: string }>,
  scoreKeys: string[]
): [number, number] {
  let max = 0
  for (const point of timeSeries) {
    for (const key of scoreKeys) {
      const val = point[key]
      if (typeof val === "number" && val > max) max = val
    }
  }
  // If all values <= 1, assume 0-1 scale; otherwise 0-10
  return max <= 1 ? [0, 1] : [0, 10]
}

export function PerformanceChart({ timeSeries, dimensionNames }: PerformanceChartProps) {
  if (!timeSeries || timeSeries.length === 0) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-center space-y-2 px-6">
          <p className="text-sm font-medium text-muted-foreground">
            No performance data available yet
          </p>
          <p className="text-xs text-muted-foreground/70">
            Score trends will appear here once Langfuse receives user ratings and evaluation scores.
          </p>
        </div>
      </Card>
    )
  }

  const scoreKeys = detectScoreKeys(timeSeries, dimensionNames)
  const chartConfig = buildChartConfig(scoreKeys)
  const yDomain = detectYDomain(timeSeries, scoreKeys)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
        <CardDescription>Score dimensions over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              fontSize={12}
              tick={{ fill: "var(--color-muted-foreground)" }}
            />
            <YAxis
              domain={yDomain}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              fontSize={12}
              tick={{ fill: "var(--color-muted-foreground)" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />

            {scoreKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={i === 0 ? 3 : 2}
                strokeDasharray={i === 0 ? undefined : "5 5"}
                dot={false}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
