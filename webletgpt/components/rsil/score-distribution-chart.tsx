"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ScoreDistributionData, ScoreDistributionBucket } from "./types"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function buildChartConfig(buckets: ScoreDistributionBucket[]): ChartConfig {
  const config: ChartConfig = {}
  buckets.forEach((bucket, i) => {
    config[bucket.range] = {
      label: bucket.range,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }
  })
  return config
}

interface ScoreDistributionChartProps {
  distributions: ScoreDistributionData[]
}

export function ScoreDistributionChart({ distributions }: ScoreDistributionChartProps) {
  const defaultScore =
    distributions.find((d) => d.scoreName === "user-rating")?.scoreName ||
    distributions[0]?.scoreName
  const [selectedScore, setSelectedScore] = React.useState<string | undefined>(defaultScore)

  const activeData = distributions.find((d) => d.scoreName === selectedScore)

  if (!distributions.length || !activeData) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-2">
          <CardTitle className="text-base font-semibold">Score Distribution</CardTitle>
          <CardDescription className="text-xs">Distribution of ratings across buckets</CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-5 sm:px-5">
          <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground border-dashed border-border/50 rounded-md bg-transparent">
            Score distribution will appear here after your weblet receives ratings
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartConfig = buildChartConfig(activeData.buckets)

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Score Distribution</CardTitle>
          <CardDescription className="text-xs">Distribution of ratings across buckets</CardDescription>
        </div>
        {distributions.length > 1 && (
          <Select value={selectedScore} onValueChange={setSelectedScore}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select score" />
            </SelectTrigger>
            <SelectContent>
              {distributions.map((d) => (
                <SelectItem key={d.scoreName} value={d.scoreName}>
                  {d.scoreName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="px-2 pb-5 sm:px-5">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="secondary" className="text-xs">
            Mean: {activeData.mean.toFixed(2)}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Median: {activeData.median.toFixed(2)}
          </Badge>
        </div>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={activeData.buckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis
              dataKey="range"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              fontSize={12}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              fontSize={12}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {activeData.buckets.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
