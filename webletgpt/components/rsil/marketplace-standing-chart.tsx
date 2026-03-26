"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface MarketplaceStandingChartProps {
  weblets: Array<{ webletId: string; webletName: string; compositeScore: number }>
  currentWebletId: string
}

const chartConfig = {
  compositeScore: {
    label: "Composite Score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function MarketplaceStandingChart({
  weblets,
  currentWebletId,
}: MarketplaceStandingChartProps) {
  const isEmpty = !weblets || weblets.length <= 1

  const sortedWeblets = React.useMemo(() => {
    if (!weblets) return []
    return [...weblets].sort((a, b) => b.compositeScore - a.compositeScore)
  }, [weblets])

  const rank = React.useMemo(() => {
    return sortedWeblets.findIndex((w) => w.webletId === currentWebletId) + 1
  }, [sortedWeblets, currentWebletId])

  const chartData = React.useMemo(() => {
    return sortedWeblets.map((w) => ({
      webletId: w.webletId,
      webletName: w.webletName.length > 20 ? w.webletName.slice(0, 18) + "…" : w.webletName,
      compositeScore: parseFloat(w.compositeScore.toFixed(3)),
      isCurrent: w.webletId === currentWebletId,
    }))
  }, [sortedWeblets, currentWebletId])

  const descriptionText = React.useMemo(() => {
    if (isEmpty) return "Add more weblets to compare"
    if (rank > 0) return `Ranked #${rank} of ${sortedWeblets.length} weblet${sortedWeblets.length !== 1 ? "s" : ""}`
    return `${sortedWeblets.length} weblets compared`
  }, [isEmpty, rank, sortedWeblets.length])

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="px-5 pt-5 pb-2">
        <CardTitle className="text-base font-semibold">Marketplace Standing</CardTitle>
        <CardDescription className="text-xs">{descriptionText}</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-5 sm:px-5">
        {isEmpty ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground border-dashed border-border/50 rounded-md bg-transparent">
            Create more weblets to see marketplace comparison
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full"
            style={{ height: Math.max(200, chartData.length * 40 + 40) }}
          >
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="var(--border)"
                opacity={0.5}
              />
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(v: number) => v.toFixed(1)}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                fontSize={11}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis
                type="category"
                dataKey="webletName"
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                fontSize={11}
                tick={{ fill: "var(--muted-foreground)" }}
                width={100}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [
                      typeof value === "number" ? (value * 100).toFixed(1) + "%" : String(value),
                      "Score",
                    ]}
                  />
                }
              />
              <Bar dataKey="compositeScore" radius={[0, 4, 4, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.webletId}
                    fill={
                      entry.isCurrent
                        ? "var(--chart-1)"
                        : "color-mix(in oklch, var(--chart-4) 60%, transparent)"
                    }
                    opacity={entry.isCurrent ? 1 : 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
