"use client"

import { useMemo } from "react"
import { AnalysisResult, AnalyticsData } from "../../types"
import { calculateRsilTier } from "@/hooks/use-rsil-tier"
import { translateTerm } from "@/lib/rsil/terminology"
import { HealthProgressRing } from "../health-progress-ring"
import { UpgradeCTA } from "../upgrade-cta"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, CalendarDays, Flame, Trophy, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export interface HealthScoreTabProps {
  webletId: string
  analysisResult?: AnalysisResult | null
  analyticsData?: AnalyticsData | null
  loading?: boolean
}

export function HealthScoreTab({ webletId, analysisResult, analyticsData, loading }: HealthScoreTabProps) {
  const tierResult = useMemo(() => {
    return calculateRsilTier(analyticsData?.performanceTrend || [])
  }, [analyticsData?.performanceTrend])

  const topDimension = useMemo(() => {
    if (!analysisResult?.dimensions?.length) return null
    return [...analysisResult.dimensions].sort((a, b) => b.avgValue - a.avgValue)[0]
  }, [analysisResult?.dimensions])

  const weakDimension = useMemo(() => {
    if (!analysisResult?.dimensions?.length) return null
    if (analysisResult.weakDimensions?.length > 0) {
      const weakName = analysisResult.weakDimensions[0]
      return analysisResult.dimensions.find(d => d.name === weakName) || null
    }
    return [...analysisResult.dimensions].sort((a, b) => a.avgValue - b.avgValue)[0]
  }, [analysisResult])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <Skeleton className="h-32 w-32 rounded-full" />
            <Skeleton className="h-6 w-32 mt-6" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!analysisResult && !analyticsData) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed bg-gradient-to-br from-background to-muted/30">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Start Your Optimization Journey</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mb-6">
              Your weblet is ready to learn! Once you have a few conversations, RSIL will analyze patterns and show you exactly how your assistant is performing.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 max-w-md mb-6">
              <p className="text-sm font-medium mb-2">Getting Started:</p>
              <ol className="text-sm text-muted-foreground text-left space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  <span>Have conversations with your weblet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  <span>RSIL automatically tracks quality metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary">3.</span>
                  <span>Return here to see your health score and insights</span>
                </li>
              </ol>
            </div>
            <UpgradeCTA variant="secondary" source="health-empty-state" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const score = analysisResult?.compositeScore ?? 0

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center p-6 sm:p-10 bg-gradient-to-b from-background to-muted/20">
          <HealthProgressRing 
            score={score} 
            tier={tierResult.tier} 
            size="lg" 
            className="scale-75 sm:scale-100"
          />
          <div className="mt-6 sm:mt-8 text-center px-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {translateTerm("compositeScore")}
            </h2>
            <p className="text-muted-foreground mt-1 max-w-md text-xs sm:text-sm">
              Your overall quality score is based on {analysisResult?.sampleSize || 0} evaluated interactions.
              {tierResult.nextTier && ` Keep it up to reach ${translateTerm(tierResult.nextTier)}!`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {translateTerm("sampleSize")}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysisResult?.sampleSize || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Conversations processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Days Active</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData?.performanceTrend?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total days with activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tierResult.daysAtCurrentLevel}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Days at {translateTerm(tierResult.tier)} level
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Top Performing Category
            </CardTitle>
            <CardDescription>Where this weblet shines</CardDescription>
          </CardHeader>
          <CardContent>
            {topDimension ? (
              <div className="flex items-center justify-between">
                <span className="font-medium">{translateTerm(topDimension.name)}</span>
                <span className="text-green-600 font-bold">{(topDimension.avgValue * 10).toFixed(1)}/10</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough data to determine.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Biggest Opportunity
            </CardTitle>
            <CardDescription>Area to focus improvements</CardDescription>
          </CardHeader>
          <CardContent>
            {weakDimension ? (
              <div className="flex items-center justify-between">
                <span className="font-medium">{translateTerm(weakDimension.name)}</span>
                <span className="text-red-500 font-bold">{(weakDimension.avgValue * 10).toFixed(1)}/10</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not enough data to determine.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
