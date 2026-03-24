"use client"

import { useMemo } from "react"
import { ArrowUpRight, Cpu, Database, FlaskConical, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { AggregateData } from "@/components/rsil/rsil-aggregate-dashboard"

interface RSILMonochromeHudDashboardProps {
  data: AggregateData | null
  loading: boolean
  onSelectWeblet: (id: string) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function RSILMonochromeHudDashboard({ data, loading, onSelectWeblet }: RSILMonochromeHudDashboardProps) {
  const avgScoreOutOfTen = useMemo(() => {
    if (!data) return 0
    return Number((data.aggregateStats.avgCompositeScore * 10).toFixed(1))
  }, [data])

  const trendBars = useMemo(() => {
    if (!data?.trendData?.length) return []

    const recentPoints = data.trendData.slice(-16)
    return recentPoints.map((point, index) => {
      const score = clamp(point.score * 100, 0, 100)
      return {
        id: `${point.date}-${index}`,
        score,
      }
    })
  }, [data])

  const dimensionPerformance = useMemo(() => {
    if (!data?.perWebletScores.length) return []

    const accumulator = new Map<string, { total: number; count: number }>()
    for (const weblet of data.perWebletScores) {
      for (const dimension of weblet.dimensions) {
        const current = accumulator.get(dimension.name) ?? { total: 0, count: 0 }
        accumulator.set(dimension.name, {
          total: current.total + dimension.avgValue,
          count: current.count + 1,
        })
      }
    }

    return Array.from(accumulator.entries())
      .map(([name, value]) => ({
        name,
        score: value.count ? (value.total / value.count) * 100 : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }, [data])

  const pulseBars = useMemo(() => {
    if (!data?.optimizationActivity?.length) return []

    const maxCount = Math.max(...data.optimizationActivity.map((point) => point.count), 1)
    return data.optimizationActivity.map((point, index) => ({
      id: `${point.week}-${index}`,
      heightPercent: clamp((point.count / maxCount) * 100, 8, 100),
      count: point.count,
      week: point.week,
    }))
  }, [data])

  const nodes = useMemo(() => {
    if (!data?.perWebletScores.length) return []

    return [...data.perWebletScores]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 6)
  }, [data])

  const activeTestsCount = useMemo(() => {
    if (!data) return 0
    return data.activeABTestCount ?? data.perWebletScores.filter((w) => w.decision === "SUGGESTION").length
  }, [data])

  const optimizationCount = useMemo(() => {
    if (!data) return 0
    return data.optimizations30dCount ?? data.perWebletScores.filter((w) => w.decision === "AUTO_UPDATE").length
  }, [data])

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[680px] lg:col-span-3" />
          <Skeleton className="h-[680px] lg:col-span-6" />
          <Skeleton className="h-[680px] lg:col-span-3" />
        </div>
      </div>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/10 bg-black px-6 py-6 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:36px_36px]" />

      <header className="relative z-10 mb-8 flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/50">RSIL // Monochrome HUD</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">Core Dashboard</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
            {data.aggregateStats.totalWeblets} Nodes
          </Badge>
          <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
            {data.aggregateStats.totalInteractions.toLocaleString()} Interactions
          </Badge>
        </div>
      </header>

      <div className="relative z-10 grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-3">
          <div className="border border-white/20 bg-white/[0.03] p-4">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">Score Trends // 01</p>
            {trendBars.length > 0 ? (
              <div className="flex h-32 items-end gap-1.5 border-l border-white/20 px-2">
                {trendBars.map((bar, index) => (
                  <div
                    key={bar.id}
                    className={
                      index === trendBars.length - 2
                        ? "w-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                        : index % 2 === 0
                          ? "w-full bg-neutral-800"
                          : "w-full bg-neutral-700"
                    }
                    style={{ height: `${Math.max(bar.score, 12)}%` }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center border border-dashed border-white/20 text-xs text-white/55">
                Trend data unavailable
              </div>
            )}
            <div className="mt-4 flex items-end justify-between">
              <span className="text-4xl font-semibold tracking-tight">{avgScoreOutOfTen.toFixed(1)}</span>
              <span className="font-mono text-xs text-white/70">AVG SCORE / 10</span>
            </div>
          </div>

          <div className="border border-white/20 bg-white/[0.03] p-4">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">Dimension Performance</p>
            <div className="space-y-4">
              {dimensionPerformance.length > 0 ? (
                dimensionPerformance.map((item) => (
                  <div key={item.name}>
                    <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                      <span className="text-white/65">{item.name.replaceAll("_", " ")}</span>
                      <span className="text-white">{item.score.toFixed(1)}%</span>
                    </div>
                    <div className="h-[2px] bg-white/15">
                      <div className="h-full bg-white" style={{ width: `${clamp(item.score, 0, 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/55">No dimension data available.</p>
              )}
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[620px] flex-col items-center justify-center lg:col-span-6">
          <div className="absolute h-[420px] w-[420px] rounded-full border border-neutral-900" />
          <div className="absolute h-[520px] w-[520px] rounded-full border border-dashed border-neutral-900" />
          <div className="absolute h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_18%,rgba(255,255,255,0.03)_36%,rgba(0,0,0,0)_65%)] blur-[1px]" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-[250px] w-[250px] rounded-full border border-white/25" />
            <div className="absolute h-[290px] w-[290px] rounded-full border border-white/10" />
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.35em] text-white/60">Avg Composite</span>
            <span className="mt-2 text-8xl font-bold tracking-tight text-white/95">{avgScoreOutOfTen.toFixed(1)}</span>
            <div className="mt-3 h-[2px] w-16 bg-neutral-800">
              <div className="h-full w-2/3 bg-white shadow-[0_0_10px_white]" />
            </div>
          </div>

          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-8 border border-white/20 bg-black px-4 py-3 text-center">
            <div className="text-3xl font-bold">{activeTestsCount}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-white/60">Active A/B Tests</div>
          </div>

          <div className="absolute bottom-12 right-2 border border-white/20 bg-black px-4 py-3 text-center">
            <div className="text-3xl font-bold">{optimizationCount}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-white/60">Optimizations / 30d</div>
          </div>

          <div className="absolute bottom-4 left-2 border border-white/20 bg-black px-4 py-3 text-center">
            <div className="text-3xl font-bold">{data.aggregateStats.totalWeblets}</div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-white/60">Tracked Nodes</div>
          </div>

          <div className="absolute inset-x-3 bottom-0 border-t border-white/10 pt-4">
            {pulseBars.length > 0 ? (
              <>
                <div className="flex h-12 items-end gap-1">
                  {pulseBars.map((bar, index) => (
                    <div
                      key={bar.id}
                      className={index % 3 === 0 ? "h-full flex-1 bg-white" : "h-full flex-1 bg-white/30"}
                      style={{ height: `${bar.heightPercent}%` }}
                      title={`${bar.week}: ${bar.count}`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.35em] text-white/45">
                  Optimization Activity Pulse
                </p>
              </>
            ) : (
              <p className="text-center text-xs text-white/55">No optimization activity yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">Active Weblet Nodes</p>

          {nodes.length > 0 ? (
            nodes.map((node) => {
              const score = node.compositeScore * 10
              const healthy = score >= 7
              const improving = node.decision !== "NONE"

              return (
                <button
                  key={node.webletId}
                  type="button"
                  onClick={() => onSelectWeblet(node.webletId)}
                  aria-label={`Select ${node.webletName}`}
                  className="w-full border border-white/20 bg-white/[0.03] p-4 text-left transition-colors hover:bg-white/[0.08]"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-white">
                      {node.webletName}
                    </span>
                    {healthy ? <Cpu className="size-4 text-white" /> : <Database className="size-4 text-white/70" />}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-white/10 text-[10px] uppercase tracking-wider text-white">
                      Score: {score.toFixed(1)}
                    </Badge>
                    <Badge variant="secondary" className="bg-white/10 text-[10px] uppercase tracking-wider text-white">
                      Interactions: {node.interactionCount}
                    </Badge>
                    {improving && (
                      <Badge variant="secondary" className="bg-white/10 text-[10px] uppercase tracking-wider text-white">
                        {node.decision === "SUGGESTION" ? "Needs Action" : "Optimizing"}
                      </Badge>
                    )}
                  </div>
                </button>
              )
            })
          ) : (
            <div className="border border-dashed border-white/20 p-4 text-sm text-white/60">No RSIL nodes available yet.</div>
          )}

          {nodes[0] && (
            <Button
              variant="secondary"
              className="mt-4 w-full justify-between bg-white text-black hover:bg-white/90"
              onClick={() => onSelectWeblet(nodes[0].webletId)}
            >
              Inspect Top Node
              <ArrowUpRight className="size-4" />
            </Button>
          )}

          <div className="mt-6 flex items-center gap-2 border border-white/20 bg-white/[0.02] px-3 py-2 text-xs text-white/65">
            <FlaskConical className="size-3.5" />
            <Sparkles className="size-3.5" />
            Live metrics use existing RSIL APIs and persisted backend data.
          </div>
        </div>
      </div>
    </section>
  )
}
