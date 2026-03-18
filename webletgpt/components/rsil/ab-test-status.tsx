"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { FlaskConical, AlertTriangle, ArrowRight, Timer } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import type { ABTestStatus } from "@/lib/rsil/ab-test"

export interface ABTestStatusProps {
  webletId: string
  onConclude?: (winnerId: string) => void
  onCancel?: () => void
}

export function ABTestStatus({ webletId, onConclude, onCancel }: ABTestStatusProps) {
  const [status, setStatus] = useState<ABTestStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let intervalId: NodeJS.Timeout

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/rsil/ab-test?webletId=${webletId}`)
        if (res.ok) {
          const data = await res.json()
          setStatus(data)
        }
      } catch (error) {
        console.error("Failed to fetch A/B test status:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()
    intervalId = setInterval(fetchStatus, 30000)

    return () => clearInterval(intervalId)
  }, [webletId])

  if (loading) {
    return <Skeleton className="w-full h-[300px] rounded-xl" />
  }

  const data = status as (ABTestStatus & { active?: boolean }) | null

  if (!data || data.active === false || (!data.controlVersion && !data.variantVersion)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FlaskConical className="w-12 h-12 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold mt-4">No A/B Test Running</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Start an A/B test from the Optimization tab
        </p>
      </div>
    )
  }

  const {
    controlVersion,
    variantVersion,
    trafficPct = 50,
    startedAt,
    controlScores = { good: 0, total: 0 },
    variantScores = { good: 0, total: 0 },
    significance,
    canConclude
  } = data

  const controlScoreVal = controlScores.total > 0 ? controlScores.good / controlScores.total : null
  const variantScoreVal = variantScores.total > 0 ? variantScores.good / variantScores.total : null

  function getScoreColor(score: number | null) {
    if (score === null) return "text-muted-foreground"
    if (score > 0.7) return "text-green-500"
    if (score >= 0.5) return "text-yellow-500"
    return "text-red-500"
  }

  function formatScore(score: number | null) {
    if (score === null) return "—"
    return score.toFixed(2)
  }

  function getTrafficWidthClass(pct: number) {
    if (pct <= 0) return "w-0"
    if (pct <= 5) return "w-[5%]"
    if (pct <= 10) return "w-[10%]"
    if (pct <= 15) return "w-[15%]"
    if (pct <= 20) return "w-[20%]"
    if (pct <= 25) return "w-[25%]"
    if (pct <= 30) return "w-[30%]"
    if (pct <= 33) return "w-[33%]"
    if (pct <= 40) return "w-[40%]"
    if (pct <= 45) return "w-[45%]"
    if (pct <= 50) return "w-[50%]"
    if (pct <= 55) return "w-[55%]"
    if (pct <= 60) return "w-[60%]"
    if (pct <= 66) return "w-[66%]"
    if (pct <= 70) return "w-[70%]"
    if (pct <= 75) return "w-[75%]"
    if (pct <= 80) return "w-[80%]"
    if (pct <= 85) return "w-[85%]"
    if (pct <= 90) return "w-[90%]"
    if (pct <= 95) return "w-[95%]"
    return "w-full"
  }

  const hoursRunning = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 3600000)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-bold flex items-center">
            A/B Test
          </CardTitle>
          <Badge variant="outline" className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live
          </Badge>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Timer className="w-4 h-4" />
            <span>Running for {hoursRunning} hours</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono font-semibold">
                    V{controlVersion?.versionNum || "1"}
                  </span>
                  <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/10">Control</Badge>
                </div>
                <div className={getScoreColor(controlScoreVal) + " text-3xl font-bold"}>
                  {formatScore(controlScoreVal)}
                </div>
                <Progress
                  value={controlScores.total > 0 ? (controlScores.good / controlScores.total) * 100 : 0}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {controlScores.good} / {controlScores.total} scores
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono font-semibold">
                    V{variantVersion?.versionNum || "2"}
                  </span>
                  <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10">Variant</Badge>
                </div>
                <div className={getScoreColor(variantScoreVal) + " text-3xl font-bold"}>
                  {formatScore(variantScoreVal)}
                </div>
                <Progress
                  value={variantScores.total > 0 ? (variantScores.good / variantScores.total) * 100 : 0}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {variantScores.good} / {variantScores.total} scores
                </p>
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="flex rounded-full overflow-hidden h-3 mt-4">
              <div className={`bg-blue-500/70 ${getTrafficWidthClass(trafficPct)}`}></div>
              <div className="bg-amber-500/70 flex-1"></div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Control {trafficPct}%</span>
              <span>Variant {100 - trafficPct}%</span>
            </div>
          </div>

          <Card className="bg-muted/30 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Statistical Significance</span>
              {significance?.significant ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20" variant="outline">
                  Significant (p &lt; 0.05)
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Not Yet Significant
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>p-value: {significance?.pValue?.toFixed(4) || "—"}</span>
              <span>z-score: {significance?.zScore?.toFixed(2) || "—"}</span>
              
              {significance?.significant && significance.winner && (
                <div className="flex items-center text-green-600 ml-auto font-medium">
                  {significance.winner === 'control' ? 'Control Winning' : 'Variant Winning'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </div>
              )}
            </div>
          </Card>

          {canConclude && (
            <div className="mt-4 p-4 rounded-lg border bg-green-500/5 border-green-500/20 flex items-center justify-between">
              <span className="text-green-600 font-medium">Ready to Conclude</span>
              <Button
                variant="default"
                onClick={() => {
                  if (onConclude) {
                    const winnerId = significance?.winner === 'control' 
                      ? controlVersion?.id 
                      : variantVersion?.id
                    if (winnerId) onConclude(winnerId)
                  }
                }}
              >
                Conclude Test
              </Button>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onCancel}>
              <AlertTriangle className="w-4 h-4 mr-2" />
              End Test
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
