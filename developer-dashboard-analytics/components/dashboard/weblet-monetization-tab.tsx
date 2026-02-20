"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const revenueHistory = [
  { month: "Sep", revenue: 320 },
  { month: "Oct", revenue: 480 },
  { month: "Nov", revenue: 510 },
  { month: "Dec", revenue: 620 },
  { month: "Jan", revenue: 780 },
  { month: "Feb", revenue: 850 },
]

const subscribers = [
  { email: "alice@company.com", date: "2026-01-15", status: "Active" },
  { email: "bob@startup.io", date: "2026-01-22", status: "Active" },
  { email: "carol@dev.co", date: "2025-12-03", status: "Active" },
  { email: "dan@agency.net", date: "2025-11-18", status: "Cancelled" },
  { email: "eve@corp.com", date: "2026-02-01", status: "Active" },
  { email: "frank@lab.org", date: "2025-10-28", status: "Cancelled" },
]

export function WebletMonetizationTab() {
  return (
    <div className="flex flex-col gap-6">
      {/* Revenue History Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Revenue History</CardTitle>
          <CardDescription>Monthly revenue over the past 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value}`, "Revenue"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(var(--chart-1))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Subscriber List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Subscribers</CardTitle>
          <CardDescription>{subscribers.filter((s) => s.status === "Active").length} active subscribers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Subscription Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.map((sub) => (
                <TableRow key={sub.email}>
                  <TableCell className="font-medium text-foreground">{sub.email}</TableCell>
                  <TableCell className="text-muted-foreground">{sub.date}</TableCell>
                  <TableCell>
                    <Badge
                      variant={sub.status === "Active" ? "default" : "secondary"}
                      className={
                        sub.status === "Active"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : ""
                      }
                    >
                      {sub.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
