"use client"

import * as React from "react"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { ScoreDimension } from "./types"

interface DimensionRadarChartProps {
  dimensions: ScoreDimension[]
  marketplaceDimensions: ScoreDimension[]
}

function capitalizeDimension(name: string): string {
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const chartConfig = {
  weblet: {
    label: "This Weblet",
    color: "var(--chart-1)",
  },
  marketplace: {
    label: "Marketplace Avg",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function DimensionRadarChart({ dimensions, marketplaceDimensions }: DimensionRadarChartProps) {
  const isEmpty = !dimensions || dimensions.length === 0

  const chartData = React.useMemo(() => {
    if (isEmpty) return []

    return dimensions.map((dim) => {
      const marketplaceDim = marketplaceDimensions.find((md) => md.name === dim.name)
      return {
        dimension: capitalizeDimension(dim.name),
        weblet: parseFloat((dim.avgValue * 100).toFixed(1)),
        marketplace: marketplaceDim
          ? parseFloat((marketplaceDim.avgValue * 100).toFixed(1))
          : 0,
      }
    })
  }, [dimensions, marketplaceDimensions, isEmpty])

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-base font-semibold">Dimension Analysis</CardTitle>
        <CardDescription className="text-xs">
          Your weblet vs marketplace average
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-5 sm:px-5">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-muted-foreground border-dashed border-border/50 rounded-md bg-transparent">
            Dimension scores will appear after your weblet receives conversations
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="var(--border)" opacity={0.5} />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tickCount={5}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                angle={90}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [`${value}%`, ""]}
                  />
                }
              />
              <Radar
                name="marketplace"
                dataKey="marketplace"
                stroke="var(--chart-3)"
                fill="var(--chart-3)"
                fillOpacity={0.1}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              <Radar
                name="weblet"
                dataKey="weblet"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
