'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AchievementBadge } from './achievement-badge'
import type { AchievementTier } from '@/hooks/use-rsil-tier'

export interface DimensionImprovement {
  name: string
  tier?: AchievementTier
  beforeValue?: number
  afterValue?: number
}

export interface BeforeAfterComparisonProps {
  traceId: string
  webletId: string
  dimensionImprovements?: DimensionImprovement[]
  className?: string
}

interface TraceData {
  inputText: string | null
  outputText: string | null
  timestamp: string
  score?: number
}

const LOADING_STATES = {
  idle: 'idle',
  loading: 'loading',
  success: 'success',
  error: 'error',
  empty: 'empty',
} as const

type LoadingState = typeof LOADING_STATES[keyof typeof LOADING_STATES]

export function BeforeAfterComparison({
  traceId,
  webletId,
  dimensionImprovements = [],
  className,
}: BeforeAfterComparisonProps) {
  const [state, setState] = React.useState<LoadingState>(LOADING_STATES.loading)
  const [traceData, setTraceData] = React.useState<TraceData | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!traceId || !webletId) {
      setState(LOADING_STATES.empty)
      return
    }

    const fetchTraceData = async () => {
      setState(LOADING_STATES.loading)
      setErrorMessage(null)

      try {
        const url = `/api/langfuse/trace?traceId=${encodeURIComponent(traceId)}&webletId=${encodeURIComponent(webletId)}`
        const res = await fetch(url)

        if (!res.ok) {
          if (res.status === 404) {
            setErrorMessage('Trace not found')
          } else if (res.status === 403) {
            setErrorMessage('Access denied to this trace')
          } else {
            setErrorMessage('Failed to load trace data')
          }
          setState(LOADING_STATES.error)
          return
        }

        const data = (await res.json()) as TraceData

        if (!data.inputText && !data.outputText) {
          setState(LOADING_STATES.empty)
        } else {
          setTraceData(data)
          setState(LOADING_STATES.success)
        }
      } catch (err) {
        console.error('Trace fetch error:', err)
        setErrorMessage('Network error - please try again')
        setState(LOADING_STATES.error)
      }
    }

    fetchTraceData()
  }, [traceId, webletId])

  if (state === LOADING_STATES.loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-64 rounded-lg" />
              <Skeleton className="h-64 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (state === LOADING_STATES.error) {
    return (
      <Card className={cn('border-destructive/50 bg-destructive/5', className)}>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-destructive">Unable to Load Comparison</h3>
          <p className="text-sm text-muted-foreground">{errorMessage || 'An error occurred'}</p>
        </CardContent>
      </Card>
    )
  }

  if (state === LOADING_STATES.empty || !traceData) {
    return (
      <Card className={cn('border-dashed bg-gradient-to-br from-background to-muted/30', className)}>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
          <p className="text-sm text-muted-foreground">
            This conversation trace doesn't have output data yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2">
              Before & After Comparison
            </CardTitle>
            <CardDescription>
              Review the original output and optimized version side-by-side
            </CardDescription>
          </div>

          {dimensionImprovements.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {dimensionImprovements.map((dim, idx) => (
                dim.tier ? (
                  <AchievementBadge key={idx} tier={dim.tier} size="sm" />
                ) : (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {dim.name}
                  </Badge>
                )
              ))}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {/* BEFORE Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Before
              </h4>
            </div>

            <div className="bg-muted/30 rounded-lg border border-border/50 p-3 sm:p-4 min-h-[10rem] sm:min-h-[12rem] max-h-[20rem] sm:max-h-[24rem] overflow-y-auto">
              {traceData.inputText ? (
                <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {traceData.inputText}
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground italic">No input recorded</p>
              )}
            </div>

            {traceData.inputText && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {new Date(traceData.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </motion.div>

          {/* Arrow Divider (Desktop) */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg"
            >
              <ArrowRight className="h-5 w-5" />
            </motion.div>
          </div>

          {/* Mobile Arrow */}
          <div className="md:hidden flex justify-center -my-2">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg rotate-90"
            >
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </div>

          {/* AFTER Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h4 className="text-sm font-semibold uppercase tracking-wider text-primary">
                After
              </h4>
            </div>

            <div className="bg-primary/5 rounded-lg border border-primary/20 p-3 sm:p-4 min-h-[10rem] sm:min-h-[12rem] max-h-[20rem] sm:max-h-[24rem] overflow-y-auto relative">
              {traceData.outputText ? (
                <>
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {traceData.outputText}
                  </p>
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Optimized
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-xs sm:text-sm text-muted-foreground italic">No optimized output available yet</p>
              )}
            </div>

            {traceData.score !== undefined && (
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary" className="text-xs">
                  Score: {traceData.score.toFixed(2)}
                </Badge>
              </div>
            )}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  )
}
