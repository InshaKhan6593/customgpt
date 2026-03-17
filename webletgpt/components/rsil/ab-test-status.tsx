"use client"

import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Play, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import type { TestResult, WebletVersion } from "./types"

interface AbTestStatusProps {
  testResult: TestResult | null
  controlVersion?: WebletVersion | null
  testingVersion: WebletVersion | null
  currentVersionNum: number
  onPromote: () => void
  onEnd: () => void
  onRunOptimization: () => void
  isActionLoading: boolean
}

export function AbTestStatus({
  testResult,
  controlVersion,
  testingVersion,
  currentVersionNum,
  onPromote,
  onEnd,
  onRunOptimization,
  isActionLoading
}: AbTestStatusProps) {
  if (!testingVersion || !testResult) {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardHeader className="text-center pb-2">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted mx-auto mb-3">
            <Activity className="size-8 text-muted-foreground" />
          </div>
          <CardTitle>No Active Test</CardTitle>
          <CardDescription>
            RSIL is currently monitoring performance but not actively running an A/B test.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pt-4">
          <Button variant="secondary" onClick={onRunOptimization} disabled={isActionLoading}>
            <Play className="size-4 mr-2" />
            Run Optimization Now
          </Button>
        </CardFooter>
      </Card>
    )
  }

  const {
    controlScore,
    variantScore,
    controlSessions,
    variantSessions,
    improvement,
    isSignificant
  } = testResult

  const variantWins = variantScore > controlScore

  return (
    <Card className="border-primary/20 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-muted-foreground animate-pulse" />
            <CardTitle>Active A/B Test</CardTitle>
          </div>
          <Badge variant="secondary" className="animate-in fade-in">Running</Badge>
        </div>
        <CardDescription>Comparing current stable V{currentVersionNum} against proposed V{testingVersion.versionNum}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Control (V{currentVersionNum})</span>
              <Badge variant="outline">50% Traffic</Badge>
            </div>
            <div className="mt-2 text-2xl font-bold">{controlScore.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ 10</span></div>
            <div className="text-xs text-muted-foreground">{controlSessions} sessions</div>
          </div>

          <div className={`rounded-xl border p-4 flex flex-col gap-2 ${variantWins ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1">
                Variant (V{testingVersion.versionNum})
                {variantWins && <Trophy className="size-3 text-primary ml-1" />}
              </span>
              <Badge variant="outline">50% Traffic</Badge>
            </div>
            <div className="mt-2 text-2xl font-bold">
              {variantScore.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">/ 10</span>
            </div>
            <div className="text-xs text-muted-foreground">{variantSessions} sessions</div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Improvement:</span>
            <span className={`font-medium ${improvement > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Statistical Significance:</span>
            <span className="flex items-center gap-1">
              {isSignificant ? (
                <><CheckCircle2 className="size-3 text-emerald-500" /> Yes</>
              ) : (
                <><AlertTriangle className="size-3 text-amber-500" /> Need more data</>
              )}
            </span>
          </div>
        </div>

        {controlVersion && testingVersion && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Prompt Comparison</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Control (V{controlVersion.versionNum})</span>
                <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-lg p-3 max-h-40 overflow-y-auto">
                  {controlVersion.prompt}
                </pre>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Variant (V{testingVersion.versionNum})</span>
                <pre className="text-xs font-mono whitespace-pre-wrap bg-muted rounded-lg p-3 max-h-40 overflow-y-auto">
                  {testingVersion.prompt}
                </pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex gap-3 justify-end bg-muted/20 border-t py-4">
        <Button variant="outline" onClick={onEnd} disabled={isActionLoading}>
          End Test & Keep V{currentVersionNum}
        </Button>
        <Button variant="secondary" onClick={onPromote} disabled={isActionLoading || (!variantWins && !isSignificant)}>
          Promote V{testingVersion.versionNum}
          <ArrowRight className="size-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  )
}
