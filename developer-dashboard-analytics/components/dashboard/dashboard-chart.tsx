"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const data = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1
  return {
    name: `Day ${day}`,
    chats: Math.floor(Math.random() * 300) + 100,
    revenue: Math.floor(Math.random() * 200) + 50,
  }
})

export function DashboardChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Revenue & Usage Trend</CardTitle>
        <CardDescription>Chats (bars) vs Revenue (line) over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar yAxisId="left" dataKey="chats" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
