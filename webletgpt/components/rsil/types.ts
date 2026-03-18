export type RSILDecision = "NONE" | "SUGGESTION" | "AUTO_UPDATE"

export interface ScoreDimension {
  name: string
  avgValue: number
  sampleSize: number
  weight: number
}

export interface AnalysisResult {
  decision: RSILDecision
  compositeScore: number
  avgScore: number
  sampleSize: number
  lowScoredTraceIds: string[]
  dimensions: ScoreDimension[]
  weakDimensions: string[]
  reason: string
}

export interface RatingEntry {
  id: string
  eventType: string
  eventData: Record<string, unknown> | null
  createdAt: string
}

export interface ScoreMetric {
  name: string
  avgValue: number
  count: number
  p50?: number
  p90?: number
}

export interface ScoreTimeSeries {
  date: string
  [scoreName: string]: number | string
}

export interface MetricsData {
  dimensions: ScoreMetric[]
  timeSeries: ScoreTimeSeries[]
}

export interface WebletOverview {
  id: string
  name: string
  slug: string
  rsilEnabled: boolean
  totalVersions: number
  interactionCount: number
}
