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

/**
 * Fetch scores from Langfuse, automatically paginating when the requested
 * limit exceeds the API maximum of 100 per page.
 */
export async function fetchScores({
  webletId,
  fromTimestamp,
  limit = 100,
}: {
  webletId: string
  fromTimestamp?: string
  limit?: number
}) {
  const credentials = Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString("base64")
  const allData: Array<{ traceId: string; name: string; value: number; id: string }> = []
  let page = 1
  let remaining = limit

  while (remaining > 0) {
    const pageLimit = Math.min(remaining, LANGFUSE_MAX_LIMIT)
    const params = new URLSearchParams()
    params.set("limit", String(pageLimit))
    params.set("page", String(page))
    params.set("traceTags", `webletId:${webletId}`)
    if (fromTimestamp) {
      params.set("fromTimestamp", new Date(fromTimestamp).toISOString())
    }

    const res = await fetch(`${LANGFUSE_BASE}/api/public/scores?${params.toString()}`, {
      headers: { Authorization: `Basic ${credentials}` },
    })

    if (!res.ok) {
      throw new Error(`Langfuse scores API returned ${res.status}: ${await res.text()}`)
    }

    const json = await res.json() as { data: Array<{ traceId: string; name: string; value: number; id: string }>; meta: unknown }
    allData.push(...json.data)

    // Stop if this page returned fewer results than requested (no more pages)
    if (json.data.length < pageLimit) break

    remaining -= json.data.length
    page++
  }

  return { data: allData, meta: {} }
}

export async function shutdownLangfuse() {
  await langfuse.flush()
}
