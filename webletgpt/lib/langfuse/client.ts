import { LangfuseClient } from "@langfuse/client"

const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com"
const LANGFUSE_SECRET = process.env.LANGFUSE_SECRET_KEY!
const LANGFUSE_PUBLIC = process.env.LANGFUSE_PUBLIC_KEY!

export const langfuse = new LangfuseClient({
  publicKey: LANGFUSE_PUBLIC,
  secretKey: LANGFUSE_SECRET,
  baseUrl: LANGFUSE_BASE,
})

export async function pushScore({
  traceId,
  name,
  value,
  comment,
  id,
  dataType,
}: {
  traceId: string
  name: string
  value: number
  comment?: string
  id?: string
  dataType?: "NUMERIC" | "BOOLEAN" | "CATEGORICAL"
}) {
  return langfuse.score.create({
    traceId,
    name,
    value,
    comment,
    ...(id ? { id } : {}),
    ...(dataType ? { dataType } : {}),
  })
}

export async function fetchTraces({
  webletId,
  fromTimestamp,
  limit = 50,
  page = 1,
}: {
  webletId: string
  fromTimestamp?: string
  limit?: number
  page?: number
}) {
  return langfuse.api.trace.list({
    limit,
    page,
    tags: [`webletId:${webletId}`],
    ...(fromTimestamp ? { fromTimestamp: new Date(fromTimestamp).toISOString() } : {}),
  })
}

const LANGFUSE_MAX_LIMIT = 100

export async function fetchScores({
  webletId,
  fromTimestamp,
  limit = 100,
}: {
  webletId: string
  fromTimestamp?: string
  limit?: number
}) {
  if (limit <= 0) {
    return { data: [], meta: {} }
  }

  const traceIds = new Set<string>()
  let tracePage = 1

  while (true) {
    const traces = await fetchTraces({
      webletId,
      fromTimestamp,
      limit: LANGFUSE_MAX_LIMIT,
      page: tracePage,
    })

    for (const trace of traces.data) {
      if (trace.id) {
        traceIds.add(trace.id)
      }
    }

    if (traces.data.length < LANGFUSE_MAX_LIMIT) break
    tracePage++
  }

  if (traceIds.size === 0) {
    return { data: [], meta: {} }
  }

  const credentials = Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString("base64")
  const allData: Array<{ traceId: string; name: string; value: number; id: string }> = []
  let page = 1
  let fetchedRawScores = 0
  const maxRawScoresToFetch = Math.max(limit * 3, LANGFUSE_MAX_LIMIT)

  while (fetchedRawScores < maxRawScoresToFetch && allData.length < limit) {
    const pageLimit = Math.min(maxRawScoresToFetch - fetchedRawScores, LANGFUSE_MAX_LIMIT)
    const params = new URLSearchParams()
    params.set("limit", String(pageLimit))
    params.set("page", String(page))
    if (fromTimestamp) {
      params.set("fromTimestamp", new Date(fromTimestamp).toISOString())
    }

    const res = await fetch(`${LANGFUSE_BASE}/api/public/v2/scores?${params.toString()}`, {
      headers: { Authorization: `Basic ${credentials}` },
    })

    if (!res.ok) {
      throw new Error(`Langfuse scores API returned ${res.status}: ${await res.text()}`)
    }

    const json = await res.json() as { data: Array<{ traceId: string; name: string; value: number; id: string }>; meta: unknown }
    fetchedRawScores += json.data.length

    for (const score of json.data) {
      if (traceIds.has(score.traceId)) {
        allData.push(score)
      }
    }

    // Stop if this page returned fewer results than requested (no more pages)
    if (json.data.length < pageLimit) break

    page++
  }

  return { data: allData.slice(0, limit), meta: {} }
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

export interface PromptVersionScoreData {
  versionNum: number
  versionId: string
  dimensions: Array<{
    name: string
    avg: number
    count: number
    min: number
    max: number
  }>
  compositeScore: number
  totalSamples: number
}

const PROMPT_SCORE_CONFIGS: Record<string, { max: number; higherIsBetter: boolean; weight: number }> = {
  'user-rating': { max: 5, higherIsBetter: true, weight: 0.5 },
  helpfulness: { max: 1, higherIsBetter: true, weight: 0.2 },
  correctness: { max: 1, higherIsBetter: true, weight: 0.15 },
  hallucination: { max: 1, higherIsBetter: false, weight: 0.1 },
  toxicity: { max: 1, higherIsBetter: false, weight: 0.03 },
  conciseness: { max: 1, higherIsBetter: true, weight: 0.02 },
}

function normalizePromptScore(value: number, config: { max: number; higherIsBetter: boolean }): number {
  const ratio = Math.min(Math.max(value / config.max, 0), 1)
  return config.higherIsBetter ? ratio : 1 - ratio
}

export async function fetchScoresByPromptVersion({
  webletId,
  fromTimestamp,
}: {
  webletId: string
  fromTimestamp?: string
}): Promise<PromptVersionScoreData[]> {
  const tracesByVersion = new Map<string, { versionNum: number; traceIds: Set<string> }>()
  const traceVersionIdMap = new Map<string, string>()
  let tracePage = 1

  while (true) {
    const traces = await fetchTraces({
      webletId,
      fromTimestamp,
      limit: LANGFUSE_MAX_LIMIT,
      page: tracePage,
    })

    for (const trace of traces.data) {
      const traceId = trace.id
      if (!traceId) continue

      const tags = Array.isArray(trace.tags) ? trace.tags : []
      const versionIdTag = tags.find((tag): tag is string => typeof tag === 'string' && tag.startsWith('versionId:'))
      const versionId = versionIdTag?.slice('versionId:'.length)
      if (!versionId) continue

      const metadata = trace.metadata && typeof trace.metadata === 'object'
        ? trace.metadata as Record<string, unknown>
        : undefined
      const versionNumRaw = metadata?.versionNum
      const parsedVersionNum = Number.parseInt(String(versionNumRaw ?? ''), 10)
      const versionNum = Number.isFinite(parsedVersionNum) ? parsedVersionNum : 0

      const existing = tracesByVersion.get(versionId)
      if (existing) {
        existing.traceIds.add(traceId)
        if (versionNum > existing.versionNum) {
          existing.versionNum = versionNum
        }
      } else {
        tracesByVersion.set(versionId, {
          versionNum,
          traceIds: new Set([traceId]),
        })
      }

      traceVersionIdMap.set(traceId, versionId)
    }

    if (traces.data.length < LANGFUSE_MAX_LIMIT) break
    tracePage++
  }

  if (traceVersionIdMap.size === 0) {
    return []
  }

  const credentials = Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString('base64')
  const headers = { Authorization: `Basic ${credentials}` }

  const scoresByVersion = new Map<string, Map<string, number[]>>()
  let scorePage = 1

  while (true) {
    const params = new URLSearchParams()
    params.set('limit', String(LANGFUSE_MAX_LIMIT))
    params.set('page', String(scorePage))
    if (fromTimestamp) {
      params.set('fromTimestamp', new Date(fromTimestamp).toISOString())
    }

    const res = await fetch(`${LANGFUSE_BASE}/api/public/v2/scores?${params.toString()}`, {
      headers,
    })

    if (!res.ok) {
      throw new Error(`Langfuse scores API returned ${res.status}: ${await res.text()}`)
    }

    const json = await res.json() as {
      data: Array<{ traceId?: string; name?: string; value?: number }>
    }

    for (const score of json.data) {
      const traceId = score.traceId
      const name = score.name
      const value = score.value
      if (!traceId || !name || typeof value !== 'number') continue

      const versionId = traceVersionIdMap.get(traceId)
      if (!versionId) continue

      let dimensions = scoresByVersion.get(versionId)
      if (!dimensions) {
        dimensions = new Map<string, number[]>()
        scoresByVersion.set(versionId, dimensions)
      }

      const values = dimensions.get(name) ?? []
      values.push(value)
      dimensions.set(name, values)
    }

    if (json.data.length < LANGFUSE_MAX_LIMIT) break
    scorePage++
  }

  const output: PromptVersionScoreData[] = []

  for (const [versionId, traceData] of tracesByVersion.entries()) {
    const dimensionsMap = scoresByVersion.get(versionId) ?? new Map<string, number[]>()
    const dimensions = Array.from(dimensionsMap.entries())
      .map(([name, values]) => {
        const count = values.length
        const sum = values.reduce((acc, v) => acc + v, 0)
        const avg = count > 0 ? sum / count : 0
        const min = count > 0 ? Math.min(...values) : 0
        const max = count > 0 ? Math.max(...values) : 0

        return { name, avg, count, min, max }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    let totalWeight = 0
    for (const dim of dimensions) {
      if (PROMPT_SCORE_CONFIGS[dim.name]) {
        totalWeight += PROMPT_SCORE_CONFIGS[dim.name].weight
      }
    }

    let compositeScore = 0
    if (totalWeight > 0) {
      for (const dim of dimensions) {
        const config = PROMPT_SCORE_CONFIGS[dim.name]
        if (!config) continue
        const normalized = normalizePromptScore(dim.avg, config)
        compositeScore += (normalized * config.weight) / totalWeight
      }
    }

    const totalSamples = dimensions.reduce((acc, dim) => acc + dim.count, 0)

    output.push({
      versionNum: traceData.versionNum,
      versionId,
      dimensions,
      compositeScore,
      totalSamples,
    })
  }

  return output.sort((a, b) => b.versionNum - a.versionNum)
}

export async function fetchScoreMetrics({
  webletId,
  fromTimestamp,
  toTimestamp,
  granularity = 'day',
}: {
  webletId: string
  fromTimestamp: string
  toTimestamp?: string
  granularity?: 'hour' | 'day' | 'week' | 'month'
}): Promise<{ dimensions: ScoreMetric[]; timeSeries: ScoreTimeSeries[] }> {
  try {
    const credentials = Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString('base64')
    const to = toTimestamp || new Date().toISOString()

    const baseFilters = [
      {
        column: 'tags',
        operator: 'any of',
        value: [`webletId:${webletId}`],
        type: 'arrayOptions',
      },
    ]

    const dimensionQuery = JSON.stringify({
      view: 'scores-numeric',
      dimensions: [{ field: 'name' }],
      metrics: [
        { measure: 'value', aggregation: 'avg' },
        { measure: 'count', aggregation: 'count' },
        { measure: 'value', aggregation: 'p50' },
        { measure: 'value', aggregation: 'p90' },
      ],
      filters: baseFilters,
      fromTimestamp,
      toTimestamp: to,
    })

    const timeSeriesQuery = JSON.stringify({
      view: 'scores-numeric',
      dimensions: [{ field: 'name' }],
      metrics: [
        { measure: 'value', aggregation: 'avg' },
        { measure: 'count', aggregation: 'count' },
      ],
      filters: baseFilters,
      timeDimension: { granularity },
      fromTimestamp,
      toTimestamp: to,
    })

    const headers = { Authorization: `Basic ${credentials}` }

    const fetchMetrics = async (query: string) => {
      const params = new URLSearchParams({ query })
      return fetch(`${LANGFUSE_BASE}/api/public/v2/metrics?${params.toString()}`, { headers })
    }

    let [dimRes, tsRes] = await Promise.all([fetchMetrics(dimensionQuery), fetchMetrics(timeSeriesQuery)])

    if (!dimRes.ok || !tsRes.ok) {
      const unfilteredDimensionQuery = JSON.stringify({
        view: 'scores-numeric',
        dimensions: [{ field: 'name' }],
        metrics: [
          { measure: 'value', aggregation: 'avg' },
          { measure: 'count', aggregation: 'count' },
          { measure: 'value', aggregation: 'p50' },
          { measure: 'value', aggregation: 'p90' },
        ],
        fromTimestamp,
        toTimestamp: to,
      })

      const unfilteredTimeSeriesQuery = JSON.stringify({
        view: 'scores-numeric',
        dimensions: [{ field: 'name' }],
        metrics: [
          { measure: 'value', aggregation: 'avg' },
          { measure: 'count', aggregation: 'count' },
        ],
        timeDimension: { granularity },
        fromTimestamp,
        toTimestamp: to,
      })

      ;[dimRes, tsRes] = await Promise.all([
        fetchMetrics(unfilteredDimensionQuery),
        fetchMetrics(unfilteredTimeSeriesQuery),
      ])
    }

    if (!dimRes.ok || !tsRes.ok) {
      return { dimensions: [], timeSeries: [] }
    }

    const dimensions: ScoreMetric[] = []
    const timeSeries: ScoreTimeSeries[] = []

    const dimJson = await dimRes.json() as { rows?: Array<Record<string, unknown>> }
    for (const row of dimJson.rows || []) {
      dimensions.push({
        name: String(row.name || ''),
        avgValue: Number(row.value_avg ?? 0),
        count: Number(row.count_count ?? 0),
        p50: row.value_p50 != null ? Number(row.value_p50) : undefined,
        p90: row.value_p90 != null ? Number(row.value_p90) : undefined,
      })
    }

    const tsJson = await tsRes.json() as { rows?: Array<Record<string, unknown>> }
    const byDate: Record<string, ScoreTimeSeries> = {}
    for (const row of tsJson.rows || []) {
      const date = String(row.time || row.timestampDay || row.timestampMonth || row.timestampWeek || '')
      if (!date) continue

      if (!byDate[date]) byDate[date] = { date }

      const scoreName = String(row.name || 'unknown')
      byDate[date][scoreName] = Number(row.value_avg ?? 0)
      byDate[date][`${scoreName}_count`] = Number(row.count_count ?? 0)
    }

    timeSeries.push(...Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)))

    return { dimensions, timeSeries }
  } catch {
    return { dimensions: [], timeSeries: [] }
  }
}

export async function shutdownLangfuse() {
  await langfuse.flush()
}
