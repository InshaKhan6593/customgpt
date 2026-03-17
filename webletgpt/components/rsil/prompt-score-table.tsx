"use client"

import { useMemo } from "react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Hash, TrendingUp, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PromptVersionScore, PromptVersionDimensionScore } from "./types"

interface PromptScoreTableProps {
  scores: PromptVersionScore[]
  loading: boolean
}

const DIMENSIONS = [
  { key: "user-rating", label: "User Rating", max: 5, inverted: false },
  { key: "helpfulness", label: "Helpfulness", max: 1, inverted: false },
  { key: "correctness", label: "Correctness", max: 1, inverted: false },
  { key: "hallucination", label: "Hallucination", max: 1, inverted: true },
  { key: "toxicity", label: "Toxicity", max: 1, inverted: true },
  { key: "conciseness", label: "Conciseness", max: 1, inverted: false },
]

function getScoreColor(val: number, max: number, inverted: boolean) {
  const ratio = val / max
  
  if (inverted) {
    if (ratio <= 0.3) return "text-emerald-400/80 bg-emerald-400/20"
    if (ratio <= 0.6) return "text-amber-400/80 bg-amber-400/20"
    return "text-rose-400/80 bg-rose-400/20"
  } else {
    if (ratio >= 0.7) return "text-emerald-400/80 bg-emerald-400/20"
    if (ratio >= 0.4) return "text-amber-400/80 bg-amber-400/20"
    return "text-rose-400/80 bg-rose-400/20"
  }
}

function ScoreBar({ score, max, inverted }: { score: number, max: number, inverted: boolean }) {
  const percentage = Math.min(100, Math.max(0, (score / max) * 100))
  const colorClass = getScoreColor(score, max, inverted)
  const bgClass = colorClass.split(' ').find(c => c.startsWith('bg-')) || 'bg-foreground/20'
  const textClass = colorClass.split(' ').find(c => c.startsWith('text-')) || 'text-foreground'

  return (
    <div className="flex flex-col gap-1 w-full min-w-[80px]">
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium tabular-nums", textClass)}>
          {Number.isInteger(score) ? score : score.toFixed(2)}
        </span>
        <span className="text-muted-foreground scale-90">/{max}</span>
      </div>
      <div className="h-1.5 w-full bg-muted overflow-hidden rounded-full">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", bgClass)} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function PromptScoreTable({ scores, loading }: PromptScoreTableProps) {
  const sortedScores = useMemo(() => {
    return [...scores].sort((a, b) => b.versionNum - a.versionNum)
  }, [scores])

  if (loading) {
    return (
      <div className="space-y-4 rounded-md border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted-foreground">
          <BarChart3 className="size-4" />
          <span>Loading prompt scores...</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  if (scores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-md border border-border bg-card text-center space-y-3">
        <BarChart3 className="size-8 text-muted-foreground/50" />
        <div className="text-sm font-medium">No per-version score data available</div>
        <div className="text-xs text-muted-foreground max-w-sm">
          Scores will aggregate as users interact with different prompt versions. Ensure tracking is enabled.
        </div>
      </div>
    )
  }

  const latestVersionNum = Math.max(...scores.map(s => s.versionNum))

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
        <TrendingUp className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Aggregate Scores by Prompt Version</h3>
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-[100px] whitespace-nowrap">Version</TableHead>
              <TableHead className="min-w-[120px]">Composite</TableHead>
              {DIMENSIONS.map(dim => (
                <TableHead key={dim.key} className="min-w-[120px] whitespace-nowrap">
                  {dim.label}
                </TableHead>
              ))}
              <TableHead className="text-right whitespace-nowrap">Samples</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedScores.map((scoreRow) => (
              <TableRow key={scoreRow.versionId} className="border-border hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center text-foreground">
                      <Hash className="size-3 mr-0.5 text-muted-foreground" />
                      {scoreRow.versionNum}
                    </span>
                    {scoreRow.versionNum === latestVersionNum && (
                      <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-semibold">
                        Latest
                      </span>
                    )}
                  </div>
                </TableCell>
                
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="relative size-8 flex items-center justify-center rounded-full bg-muted border border-border shrink-0">
                      <span className="text-xs font-bold text-foreground tabular-nums">
                        {Math.round(scoreRow.compositeScore * 100)}
                      </span>
                      <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18" cy="18" r="16"
                          fill="none"
                          className="stroke-muted"
                          strokeWidth="2"
                        />
                        <circle
                          cx="18" cy="18" r="16"
                          fill="none"
                          className={cn(
                            "transition-all duration-500",
                            scoreRow.compositeScore >= 0.7 ? "stroke-emerald-500/80" : 
                            scoreRow.compositeScore >= 0.4 ? "stroke-amber-500/80" : "stroke-rose-500/80"
                          )}
                          strokeWidth="2"
                          strokeDasharray="100"
                          strokeDashoffset={100 - (scoreRow.compositeScore * 100)}
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </TableCell>

                {DIMENSIONS.map(dim => {
                  const dimScore = scoreRow.dimensions.find(d => d.name === dim.key)
                  return (
                    <TableCell key={dim.key}>
                      {dimScore ? (
                        <ScoreBar 
                          score={dimScore.avg} 
                          max={dim.max} 
                          inverted={dim.inverted} 
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">N/A</span>
                      )}
                    </TableCell>
                  )
                })}

                <TableCell className="text-right">
                  <span className="text-sm text-muted-foreground tabular-nums font-medium">
                    {scoreRow.totalSamples.toLocaleString()}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}