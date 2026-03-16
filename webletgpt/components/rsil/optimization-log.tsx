"use client"

import { motion } from "framer-motion"
import {
  ArrowUpCircle,
  CheckCircle2,
  Clock,
  FlaskConical,
  GitBranch,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { WebletVersion } from "./types"

type LogEntryType =
  | "optimization_started"
  | "optimization_complete"
  | "ab_test_started"
  | "ab_test_ended"
  | "version_promoted"
  | "version_rolled_back"
  | "rsil_enabled"
  | "rsil_disabled"

interface LogEntry {
  id: string
  type: LogEntryType
  message: string
  timestamp: string
  versionNum?: number
}

interface OptimizationLogProps {
  versions: WebletVersion[]
  loading: boolean
}

const LOG_ICONS: Record<LogEntryType, { icon: typeof Sparkles; className: string }> = {
  optimization_started: { icon: Play, className: "text-blue-500 bg-blue-500/10" },
  optimization_complete: { icon: CheckCircle2, className: "text-emerald-500 bg-emerald-500/10" },
  ab_test_started: { icon: FlaskConical, className: "text-violet-500 bg-violet-500/10" },
  ab_test_ended: { icon: XCircle, className: "text-amber-500 bg-amber-500/10" },
  version_promoted: { icon: ArrowUpCircle, className: "text-emerald-500 bg-emerald-500/10" },
  version_rolled_back: { icon: RotateCcw, className: "text-rose-500 bg-rose-500/10" },
  rsil_enabled: { icon: Sparkles, className: "text-primary bg-primary/10" },
  rsil_disabled: { icon: XCircle, className: "text-muted-foreground bg-muted" },
}

function deriveLogEntries(versions: WebletVersion[]): LogEntry[] {
  const entries: LogEntry[] = []
  const sorted = [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  for (const v of sorted) {
    entries.push({
      id: `${v.id}-created`,
      type: "optimization_complete",
      message: `V${v.versionNum} created${v.commitMsg ? `: ${v.commitMsg}` : ""}`,
      timestamp: v.createdAt,
      versionNum: v.versionNum,
    })

    if (v.isAbTest && v.abTestStartedAt) {
      entries.push({
        id: `${v.id}-ab-start`,
        type: "ab_test_started",
        message: `A/B test started for V${v.versionNum} (${v.abTestTrafficPct}% traffic)`,
        timestamp: v.abTestStartedAt,
        versionNum: v.versionNum,
      })
    }

    if (v.isAbTest && v.abTestEndedAt) {
      entries.push({
        id: `${v.id}-ab-end`,
        type: v.abTestWinner ? "version_promoted" : "ab_test_ended",
        message: v.abTestWinner
          ? `V${v.versionNum} promoted as winner`
          : `A/B test ended for V${v.versionNum}`,
        timestamp: v.abTestEndedAt,
        versionNum: v.versionNum,
      })
    }

    if (v.status === "ROLLED_BACK") {
      entries.push({
        id: `${v.id}-rollback`,
        type: "version_rolled_back",
        message: `V${v.versionNum} rolled back`,
        timestamp: v.createdAt,
        versionNum: v.versionNum,
      })
    }
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

function LogSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function OptimizationLog({ versions, loading }: OptimizationLogProps) {
  if (loading) {
    return <LogSkeleton />
  }

  const entries = deriveLogEntries(versions)

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-5" />
            Activity Log
          </CardTitle>
          <CardDescription>
            RSIL optimization events will appear here once the system begins analyzing interactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Clock className="size-8 mb-3 opacity-50" />
            <p className="text-sm">No activity yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="size-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Timeline of RSIL optimization actions and version changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

          {entries.slice(0, 20).map((entry, i) => {
            const logIcon = LOG_ICONS[entry.type]
            const Icon = logIcon.icon

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                className="relative flex gap-3 pb-4 last:pb-0"
              >
                <div
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full",
                    logIcon.className
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-medium leading-tight">
                    {entry.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(entry.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
