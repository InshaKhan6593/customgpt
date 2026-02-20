import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Star, Users, DollarSign, TrendingUp, TrendingDown } from "lucide-react"

const stats = [
  {
    title: "Total Chats",
    value: "12,847",
    trend: "+12.3%",
    trendUp: true,
    icon: MessageSquare,
  },
  {
    title: "Average Rating",
    value: "4.6 / 5.0",
    trend: "+0.2",
    trendUp: true,
    icon: Star,
  },
  {
    title: "Active Subscribers",
    value: "342",
    trend: "+8.1%",
    trendUp: true,
    icon: Users,
  },
  {
    title: "Total Revenue",
    value: "$4,280.00",
    trend: "-2.4%",
    trendUp: false,
    icon: DollarSign,
  },
]

export function DashboardStatsCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="mt-1 flex items-center gap-1 text-xs">
                {stat.trendUp ? (
                  <TrendingUp className="h-3 w-3 text-primary" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span className={stat.trendUp ? "text-primary" : "text-destructive"}>
                  {stat.trend}
                </span>
                <span className="text-muted-foreground">from last month</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
