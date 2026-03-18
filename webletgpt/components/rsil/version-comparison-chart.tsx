"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import type { VersionComparisonData } from "./types"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const statusColors: Record<string, string> = {
  ACTIVE: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5",
  TESTING: "text-amber-500 border-amber-500/30 bg-amber-500/5",
  DRAFT: "text-blue-500 border-blue-500/30 bg-blue-500/5",
  ROLLED_BACK: "text-rose-500 border-rose-500/30 bg-rose-500/5",
  ARCHIVED: "text-muted-foreground border-border",
}

function formatDimensionLabel(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

interface VersionComparisonChartProps {
  versions: VersionComparisonData[]
}

export function VersionComparisonChart({ versions }: VersionComparisonChartProps) {
  const { chartData, dimensions, chartConfig } = React.useMemo(() => {
    const uniqueDims = new Set<string>()
    for (const v of versions) {
      for (const dim of v.dimensions) {
        uniqueDims.add(dim.name)
      }
    }
    const dims = Array.from(uniqueDims)

    const config: ChartConfig = {}
    dims.forEach((dim, i) => {
      config[dim] = {
        label: formatDimensionLabel(dim),
        color: CHART_COLORS[i % CHART_COLORS.length],
      }
    })

    const data = versions.map((v) => {
      const point: Record<string, string | number> = {
        version: `v${v.versionNum}`,
        versionId: v.versionId,
        sampleSize: v.sampleSize,
        avgScore: v.avgScore,
      }
      for (const dim of v.dimensions) {
        point[dim.name] = dim.avgValue
      }
      return point
    })

    return { chartData: data, dimensions: dims, chartConfig: config }
  }, [versions])

  const isEmpty = !versions || versions.length === 0

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-base font-semibold">Version Comparison</CardTitle>
        <CardDescription className="text-xs">Score dimensions across versions</CardDescription>
        {!isEmpty && (
          <div className="flex flex-wrap gap-2 mt-3">
            {versions.map((v) => (
              <div key={v.versionId} className="flex items-center gap-1.5 text-xs">
                <span className="font-medium">v{v.versionNum}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] uppercase tracking-wider h-5 px-1.5 font-medium ${statusColors[v.status] || statusColors.ARCHIVED}`}
                >
                  {v.status}
                </Badge>
                <span className="text-muted-foreground">(n={v.sampleSize})</span>
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-2 pb-5 sm:px-5">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground border-dashed border-border/50 rounded-md bg-transparent">
            Version comparison will appear here after multiple versions receive scores
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis
                dataKey="version"
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
              <ChartTooltip content={<ChartTooltipContent indicator="dashed" />} />
              <ChartLegend content={<ChartLegendContent />} />
              {dimensions.map((dim) => (
                <Bar
                  key={dim}
                  dataKey={dim}
                  fill={`var(--color-${dim})`}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
