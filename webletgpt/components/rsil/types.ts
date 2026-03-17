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

export interface GovernanceConfig {
  minInteractionsBeforeOptimize: number
  cooldownHours: number
  maxUpdatesPerDay: number
  minTestDurationHours: number
  requireCreatorApproval: boolean
  performanceFloor: number
  autoOptimizationEnabled: boolean
  autoOptimizationFrequency: 'every_6h' | 'every_12h' | 'daily' | 'weekly'
  autoOptimizationHour: number
}

export interface WebletVersion {
  id: string
  webletId: string
  versionNum: number
  prompt: string
  status: string
  commitMsg: string | null
  model: string
  isAbTest: boolean
  abTestTrafficPct: number
  abTestStartedAt: string | null
  abTestEndedAt: string | null
  abTestWinner: boolean | null
  avgScore: number | null
  createdAt: string
}

export interface ActiveTestInfo {
  id: string
  versionNum: number
  abTestTrafficPct: number
  abTestStartedAt: string | null
}

export interface LatestVersionInfo {
  id: string
  versionNum: number
  status: string
  avgScore: number | null
  commitMsg: string | null
  prompt?: string
}

export interface RatingEntry {
  id: string
  eventType: string
  eventData: Record<string, unknown> | null
  createdAt: string
}

export interface WebletOverview {
  id: string
  name: string
  slug: string
  rsilEnabled: boolean
  rsilGovernance: GovernanceConfig | null
  latestVersion: LatestVersionInfo | null
  activeTest: ActiveTestInfo | null
  totalVersions: number
  interactionCount: number
}

export interface TestResult {
  controlScore: number
  variantScore: number
  controlSessions: number
  variantSessions: number
  improvement: number
  pValue: number
  isSignificant: boolean
}
