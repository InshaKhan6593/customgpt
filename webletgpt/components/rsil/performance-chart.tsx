"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import type { ScoreDimension } from "./types"

const chartConfig = {
  composite: { label: "Composite Score", color: "var(--color-primary)" },
  helpfulness: { label: "Helpfulness", color: "var(--color-blue-500)" },
  accuracy: { label: "Accuracy", color: "var(--color-emerald-500)" },
  tone: { label: "Tone", color: "var(--color-amber-500)" },
}

interface PerformanceChartProps {
  data: any[]
  dimensions: ScoreDimension[]
}

export function PerformanceChart({ data, dimensions }: PerformanceChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No performance data available for this timeframe.</p>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Trends</CardTitle>
        <CardDescription>Composite score and individual dimensions over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tickMargin={10} 
              fontSize={12}
              tick={{ fill: 'var(--color-muted-foreground)' }}
            />
            <YAxis 
              domain={[0, 10]} 
              axisLine={false} 
              tickLine={false} 
              tickMargin={10}
              fontSize={12}
              tick={{ fill: 'var(--color-muted-foreground)' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            
            <Line
              type="monotone"
              dataKey="composite"
              stroke="var(--color-primary)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6 }}
            />
            {dimensions.map((dim, i) => (
              <Line
                key={dim.name}
                type="monotone"
                dataKey={dim.name}
                stroke={`hsl(var(--chart-${(i % 5) + 1}))`}
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
