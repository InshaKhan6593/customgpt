"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Bot,
  TrendingUp,
  MessageSquare,
  Clock,
  ArrowRight,
  Activity,
} from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DimensionScore = {
  name: string
  avgValue: number
  sampleSize: number
  weight: number
}

type Analysis = {
  compositeScore: number
  dimensions: DimensionScore[]
  interactionCount: number
  decision: "NONE" | "SUGGESTION" | "AUTO_UPDATE"
}

type ScoresResponse = {
  analysis: Analysis | null
  recentRatings: Array<{
    id: string
    eventType: string
    metadata: any
    createdAt: string
  }>
  metrics?: any
}

type AggregateResponse = {
  perWebletScores: Array<{
    webletId: string
    webletName: string
    compositeScore: number
    dimensions: DimensionScore[]
    interactionCount: number
    decision: string
  }>
}

type WebletVersion = {
  id: string
  versionNum: number
  status: "ACTIVE" | "TESTING" | "DRAFT" | "ARCHIVED"
  createdAt: string
  prompt: string
  commitMsg?: string | null
}

type VersionsResponse = {
  data: WebletVersion[]
}

function getVersionsArray(data: VersionsResponse | WebletVersion[]): WebletVersion[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.data)) return data.data
  return []
}

export default function RSILOverviewPage({
  params,
}: {
  params: Promise<{ webletId: string }>
}) {
  const router = useRouter()
  const [webletId, setWebletId] = useState<string | null>(null)
  const [scoresData, setScoresData] = useState<ScoresResponse | null>(null)
  const [aggregateData, setAggregateData] = useState<AggregateResponse | null>(null)
  const [versionsData, setVersionsData] = useState<WebletVersion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then((p) => setWebletId(p.webletId))
  }, [params])

  useEffect(() => {
    if (!webletId) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const versionsRes = await fetch(`/api/weblets/${webletId}/versions`)

        if (!versionsRes.ok) {
          throw new Error("Failed to load RSIL data")
        }

        const versions: VersionsResponse | WebletVersion[] = await versionsRes.json()

        if (!cancelled) {
          setVersionsData(getVersionsArray(versions).slice(0, 5))
        }
      } catch (error) {
        console.error("RSIL overview error:", error)
        toast.error("Failed to load overview data")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }

      try {
        const [scoresRes, aggregateRes] = await Promise.all([
          fetch(`/api/rsil/scores?webletId=${webletId}`),
          fetch("/api/rsil/aggregate"),
        ])

        if (!scoresRes.ok || !aggregateRes.ok) {
          return
        }

        const scores: ScoresResponse = await scoresRes.json()
        const aggregate: AggregateResponse = await aggregateRes.json()

        if (!cancelled) {
          setScoresData(scores)
          setAggregateData(aggregate)
        }
      } catch {
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [webletId])

  if (loading || !webletId) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  const webletScore = aggregateData?.perWebletScores.find(
    (score) => score.webletId === webletId
  )

  const compositeScore = webletScore?.compositeScore ?? scoresData?.analysis?.compositeScore ?? 0
  const dimensions = webletScore?.dimensions ?? scoresData?.analysis?.dimensions ?? []
  const interactionCount = webletScore?.interactionCount ?? scoresData?.analysis?.interactionCount ?? 0

  const hasScoreData = compositeScore > 0 || dimensions.length > 0
  const status = hasScoreData ? "active" : "pending"

  const activeVersion = versionsData.find((v) => v.status === "ACTIVE")
  const testingVersion = versionsData.find((v) => v.status === "TESTING")

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <Badge
          variant={status === "active" ? "default" : "outline"}
          className={cn(
            status === "active" && "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
            status === "pending" && "border-orange-300 text-orange-700"
          )}
        >
          {status === "active" ? "Active" : "Pending"}
        </Badge>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Composite Score</CardTitle>
            <Bot className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasScoreData ? compositeScore.toFixed(1) : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasScoreData ? "Overall performance" : "No data yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Interactions</CardTitle>
            <MessageSquare className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interactionCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Conversations tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Version</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeVersion ? `v${activeVersion.versionNum}` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {activeVersion ? "Currently deployed" : "No deployment"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A/B Testing</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {testingVersion ? "Active" : "None"}
            </div>
            <p className="text-xs text-muted-foreground">
              {testingVersion ? `Testing v${testingVersion.versionNum}` : "No tests running"}
            </p>
          </CardContent>
        </Card>
      </div>

      {hasScoreData && dimensions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score Breakdown</CardTitle>
            <CardDescription>
              Performance metrics across key dimensions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {dimensions.map((dim) => (
                <div
                  key={dim.name}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {dim.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      n={dim.sampleSize}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {(dim.avgValue * 10).toFixed(1)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / 10.0
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(dim.avgValue * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Versions</CardTitle>
            <CardDescription>
              Latest {versionsData.length} version{versionsData.length !== 1 ? "s" : ""} of your weblet
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/dashboard/rsil/${webletId}/deployments`)}
            className="gap-2"
          >
            View all versions
            <ArrowRight className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {versionsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Clock className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No versions yet. Create your first deployment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versionsData.map((version) => (
                <div
                  key={version.id}
                  className="flex items-start justify-between gap-4 rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">v{version.versionNum}</span>
                      <Badge
                        variant={
                          version.status === "ACTIVE"
                            ? "default"
                            : version.status === "TESTING"
                            ? "secondary"
                            : "outline"
                        }
                        className={cn(
                          version.status === "ACTIVE" &&
                            "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
                          version.status === "TESTING" &&
                            "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
                        )}
                      >
                        {version.status}
                      </Badge>
                    </div>
                    {version.commitMsg && (
                      <p className="text-sm text-muted-foreground">
                        {version.commitMsg}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(version.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasScoreData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Bot className="size-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No Performance Data Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Start collecting data by deploying a version and having users interact with your weblet.
              Scores will appear here as data accumulates.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
