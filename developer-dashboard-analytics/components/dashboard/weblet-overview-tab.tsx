"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const dailyChatData = Array.from({ length: 14 }, (_, i) => ({
  name: `Day ${i + 1}`,
  chats: Math.floor(Math.random() * 200) + 50,
}))

const TOPICS = [
  "React hooks", "API design", "TypeScript generics", "Next.js routing",
  "Database queries", "Auth patterns", "State management", "Testing",
  "Performance", "Deployment",
]

export function WebletOverviewTab() {
  return (
    <div className="flex flex-col gap-6">
      {/* Daily Chat Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Daily Chat Trend</CardTitle>
          <CardDescription>Chat volume over the past 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChatData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} interval={1} />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="chats" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Latest Chat Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Latest Chat Topics</CardTitle>
            <CardDescription>Most common phrases from recent conversations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((topic) => (
                <Badge key={topic} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Rank */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Category Rank</CardTitle>
            <CardDescription>Your position in the CODE category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 py-4">
              <span className="text-5xl font-bold text-primary">#4</span>
              <span className="text-sm text-muted-foreground">in Code</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
