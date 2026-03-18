"use client"

import { useEffect, useState, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScoreDistributionChart } from "./score-distribution-chart"
import { VersionComparisonChart } from "./version-comparison-chart"
import { PerformanceTrendChart } from "./performance-trend-chart"
import type { AnalyticsData } from "./types"

interface AnalyticsTabProps {
  webletId: string
}

export function AnalyticsTab({ webletId }: AnalyticsTabProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState("168")

  const fetchAnalytics = useCallback(async () => {
    if (!webletId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/rsil/analytics?webletId=${webletId}&hours=${hours}`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      const result: AnalyticsData = await res.json()
      setData(result)
    } catch {
      toast.error("Failed to load analytics data")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [webletId, hours])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-[200px] rounded-md" />
          <Skeleton className="h-9 w-[100px] rounded-md" />
        </div>
        <Skeleton className="w-full h-[380px] rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="w-full h-[380px] rounded-xl" />
          <Skeleton className="w-full h-[380px] rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Tabs value={hours} onValueChange={setHours}>
          <TabsList>
            <TabsTrigger value="24">24h</TabsTrigger>
            <TabsTrigger value="168">7d</TabsTrigger>
            <TabsTrigger value="720">30d</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          {data?.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Last updated:{" "}
              {new Date(data.lastUpdated).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!data ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No analytics data available. Analytics will appear after your weblet receives conversations.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <PerformanceTrendChart trend={data.performanceTrend} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScoreDistributionChart distributions={data.scoreDistribution} />
            <VersionComparisonChart versions={data.versionComparison} />
          </div>
        </div>
      )}
    </div>
  )
}
