"use client"

import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MessageSquare, Star, Users, DollarSign, TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ComposedChart } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const STATS = [
  { label: "Total Chats", value: "24,891", trend: "+12.4%", up: true, icon: MessageSquare },
  { label: "Average Rating", value: "4.6 / 5.0", trend: "+0.2", up: true, icon: Star },
  { label: "Active Subscribers", value: "342", trend: "+28", up: true, icon: Users },
  { label: "Total Revenue", value: "$4,280.00", trend: "-3.1%", up: false, icon: DollarSign },
]

const CHART_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  chats: Math.floor(Math.random() * 400 + 600),
  revenue: Math.floor(Math.random() * 100 + 80),
}))

const WEBLETS = [
  { id: "codebot", name: "Codebot 3000", category: "CODE", status: "Active", chats: 12400, rating: 4.8, revenue: "$2,100" },
  { id: "marketing", name: "Marketing Wizard", category: "MARKETING", status: "Active", chats: 8200, rating: 4.6, revenue: "$1,580" },
  { id: "analyst", name: "Data Analyst Pro", category: "DATA_ANALYSIS", status: "Active", chats: 3100, rating: 4.9, revenue: "$480" },
  { id: "writer", name: "Essay Helper", category: "WRITING", status: "Draft", chats: 1191, rating: 4.3, revenue: "$120" },
]

const chartConfig = {
  chats: { label: "Chats", color: "var(--color-chart-1)" },
  revenue: { label: "Revenue ($)", color: "var(--color-chart-2)" },
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Developer Dashboard</h1>
          <Link href="/builder/new">
            <Button size="sm">Create New Weblet</Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{stat.value}</p>
                  <div className={`mt-1 flex items-center gap-1 text-xs ${stat.up ? "text-success" : "text-destructive"}`}>
                    {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {stat.trend}
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Revenue & Usage Trend (30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={CHART_DATA}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={false} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar yAxisId="left" dataKey="chats" fill="var(--color-chart-1)" radius={[2, 2, 0, 0]} opacity={0.8} />
                  <Line yAxisId="right" dataKey="revenue" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Weblets Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My Weblets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Weblet</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">30-Day Chats</TableHead>
                  <TableHead className="text-right">Avg Rating</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="w-32"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {WEBLETS.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium text-foreground">{w.name}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{w.category.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={w.status === "Active" ? "default" : "secondary"} className="text-[10px]">{w.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{w.chats.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <span className="flex items-center justify-end gap-1">
                        <Star className="h-3 w-3 fill-warning text-warning" />{w.rating}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{w.revenue}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/weblet/${w.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1">
                          View Analytics <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
