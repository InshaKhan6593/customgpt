import { LangfuseClient } from "@langfuse/client"

const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com"
const LANGFUSE_SECRET = process.env.LANGFUSE_SECRET_KEY!
const LANGFUSE_PUBLIC = process.env.LANGFUSE_PUBLIC_KEY!

export const langfuse = new LangfuseClient({
  publicKey: LANGFUSE_PUBLIC,
  secretKey: LANGFUSE_SECRET,
  baseUrl: LANGFUSE_BASE,
})

const LANGFUSE_MAX_LIMIT = 100

/** Basic auth header for direct Langfuse REST API calls */
function getLangfuseAuthHeader(): string {
  return `Basic ${Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString("base64")}`
}

/**
 * Fetch scores from Langfuse filtered by webletId trace tag.
 * Uses /api/public/v2/scores with traceTags param — single efficient call.
 *
 * Note: @langfuse/client@5.0.1 does not expose scoreV2.get() at runtime
 * (only create/delete via _legacy.scoreV1), so we use the REST API directly.
 */
export async function fetchScores({
  webletId,
  versionId,
  fromTimestamp,
  limit = 100,
}: {
  webletId: string
  versionId?: string
  fromTimestamp?: string
  limit?: number
}) {
  if (limit <= 0) {
    return { data: [], meta: {} }
  }

  try {
    const allData: Array<{ traceId: string; name: string; value: number; id: string }> = []
    let currentPage = 1

    while (allData.length < limit) {
      const pageLimit = Math.min(limit - allData.length, LANGFUSE_MAX_LIMIT)
      const params = new URLSearchParams()
      params.set("limit", String(pageLimit))
      params.set("page", String(currentPage))
      const tags = [`webletId:${webletId}`]
      if (versionId) tags.push(`versionId:${versionId}`)
      params.set("traceTags", tags.join(','))
      if (fromTimestamp) {
        params.set("fromTimestamp", new Date(fromTimestamp).toISOString())
      }

      const res = await fetch(`${LANGFUSE_BASE}/api/public/v2/scores?${params.toString()}`, {
        headers: { Authorization: getLangfuseAuthHeader() },
      })

      if (!res.ok) {
        console.error(`Langfuse scores API returned ${res.status}: ${await res.text()}`)
        break
      }

      const json = (await res.json()) as {
        data: Array<{ traceId: string; name: string; value: unknown; id: string }>
        meta: unknown
      }

      for (const score of json.data) {
        if (typeof score.value === "number") {
          allData.push({
            traceId: score.traceId,
            name: score.name,
            value: score.value,
            id: score.id,
          })
        }
      }

      if (json.data.length < pageLimit) break

      currentPage++
    }

    return { data: allData, meta: {} }
  } catch (error) {
    console.error('[langfuse] fetchScores failed (Langfuse unreachable):', error)
    return { data: [], meta: {} }
  }
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

/**
 * Runtime-typed accessor for langfuse.api.metrics which exists at runtime
 * as langfuse.api.metrics.metrics({ query }) in @langfuse/client@5.0.1.
 */
type LangfuseMetricsApi = {
  metrics: {
    metrics(request: { query: string }): Promise<{ data: Record<string, unknown>[] }>
  }
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
    const to = toTimestamp || new Date().toISOString()
    const metricsApi = langfuse.api as unknown as LangfuseMetricsApi

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

    let dimRes: { data: Record<string, unknown>[] }
    let tsRes: { data: Record<string, unknown>[] }

    try {
      ;[dimRes, tsRes] = await Promise.all([
        metricsApi.metrics.metrics({ query: dimensionQuery }),
        metricsApi.metrics.metrics({ query: timeSeriesQuery }),
      ])
    } catch {
      // Fallback: retry without tag filters (some Langfuse plans may not support arrayOptions filters)
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
        metricsApi.metrics.metrics({ query: unfilteredDimensionQuery }),
        metricsApi.metrics.metrics({ query: unfilteredTimeSeriesQuery }),
      ])
    }

    const dimensions: ScoreMetric[] = []
    const timeSeries: ScoreTimeSeries[] = []

    for (const row of dimRes.data) {
      dimensions.push({
        name: String(row.name || '').toLowerCase(),
        avgValue: Number(row.value_avg ?? 0),
        count: Number(row.count_count ?? 0),
        p50: row.value_p50 != null ? Number(row.value_p50) : undefined,
        p90: row.value_p90 != null ? Number(row.value_p90) : undefined,
      })
    }

    const byDate: Record<string, ScoreTimeSeries> = {}
    for (const row of tsRes.data) {
      const date = String(row.time || row.timestampDay || row.timestampMonth || row.timestampWeek || '')
      if (!date) continue

      if (!byDate[date]) byDate[date] = { date }

      const scoreName = String(row.name || 'unknown').toLowerCase()
      byDate[date][scoreName] = Number(row.value_avg ?? 0)
      byDate[date][`${scoreName}_count`] = Number(row.count_count ?? 0)
    }

    timeSeries.push(...Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)))

    return { dimensions, timeSeries }
  } catch {
    return { dimensions: [], timeSeries: [] }
  }
}

export async function createLangfuseScore({
  traceId,
  name,
  value,
  dataType = "NUMERIC",
  comment,
  id,
}: {
  traceId: string
  name: string
  value: number
  dataType?: "NUMERIC" | "BOOLEAN"
  comment?: string
  id?: string
}): Promise<{ id: string } | null> {
  try {
    const body: Record<string, unknown> = { traceId, name, value, dataType }
    if (comment !== undefined) body.comment = comment
    if (id !== undefined) body.id = id

    const res = await fetch(`${LANGFUSE_BASE}/api/public/scores`, {
      method: "POST",
      headers: {
        Authorization: getLangfuseAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.warn('[langfuse] score creation failed:', res.status)
      return null
    }

    const json = (await res.json()) as { id: string }
    return { id: json.id }
  } catch (error) {
    console.warn('[langfuse] score creation failed:', error)
    return null
  }
}

export async function shutdownLangfuse() {
  await langfuse.flush()
}
