"use client"

import React from "react"
import { Sparkles, TrendingUp, History, Brain } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { translateTerm } from "@/lib/rsil/terminology"
import { UpgradeCTA } from "../upgrade-cta"

import { ABTestStatus } from "../../ab-test-status"
import { VersionHistory } from "../../version-history"

interface ImprovementsTabProps {
  webletId: string
  optimizations30dCount?: number
  weeklySummary?: string
  versions?: Array<{
    id: string
    versionNum: number
    status: string
    avgScore: number | null
    model: string | null
    prompt: string
    commitMsg: string | null
    createdAt: string | Date
    isAbTest: boolean
  }>
  onRollback?: (webletId: string) => void
  onStartTest?: (versionId: string) => void
  onDeploy?: (versionId: string) => void
  onConcludeTest?: (winnerId: string) => void
  onCancelTest?: () => void
}

export function ImprovementsTab({ 
  webletId,
  optimizations30dCount = 0,
  weeklySummary = "No recent optimization activity.",
  versions = [],
  onRollback = () => {},
  onStartTest,
  onDeploy,
  onConcludeTest,
  onCancelTest
}: ImprovementsTabProps) {
  const hasActivity = optimizations30dCount > 0 || weeklySummary !== "No recent optimization activity."

  return (
    <div className="space-y-8">
      {/* Top Section: Optimization Summary or Empty State */}
      {hasActivity ? (
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                30-Day Optimizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{optimizations30dCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Successful improvements applied
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Weekly Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium leading-relaxed mt-1">
                {weeklySummary}
              </p>
            </CardContent>
          </Card>
        </section>
      ) : (
        <Card className="border-dashed bg-gradient-to-br from-background to-muted/30">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">RSIL is Learning</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              No improvements yet—that's completely normal! RSIL needs to observe your weblet's conversations to understand patterns and identify optimization opportunities.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 max-w-md mb-6">
              <p className="text-sm font-medium mb-2">How It Works:</p>
              <ul className="text-sm text-muted-foreground text-left space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>RSIL collects quality metrics from real conversations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Patterns emerge over time revealing improvement areas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>When ready, RSIL proposes tested optimizations here</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <Button size="lg" variant="outline" onClick={() => window.location.href = `/weblet/${webletId}`} className="flex-1">
                <Sparkles className="h-4 w-4 mr-2" />
                View Your Weblet
              </Button>
              <UpgradeCTA variant="secondary" source="improvements-empty-state" className="flex-1" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Middle Section: A/B Test Status */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{translateTerm('abTest')} Status</h3>
          <p className="text-sm text-muted-foreground">
            Monitor active comparisons to determine the most effective {translateTerm('versionNum').toLowerCase()}
          </p>
        </div>
        <ABTestStatus 
          webletId={webletId} 
          onConclude={onConcludeTest}
          onCancel={onCancelTest}
        />
      </section>

      {/* Bottom Section: Version History */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">History & Rollback</h3>
          <p className="text-sm text-muted-foreground">
            View all previous iterations and restore if necessary
          </p>
        </div>
        
        {versions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">No Version History</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">
                This weblet hasn't had any optimizations yet. New versions will appear here when applied.
              </p>
            </CardContent>
          </Card>
        ) : (
          <VersionHistory 
            versions={versions}
            webletId={webletId}
            onRollback={onRollback}
            onStartTest={onStartTest}
            onDeploy={onDeploy}
          />
        )}
      </section>
    </div>
  )
}
