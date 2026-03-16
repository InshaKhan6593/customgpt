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

export async function fetchScores({
  webletId,
  fromTimestamp,
  limit = 100,
}: {
  webletId: string
  fromTimestamp?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  params.set("limit", String(limit))
  params.set("traceTags", `webletId:${webletId}`)
  if (fromTimestamp) {
    params.set("fromTimestamp", new Date(fromTimestamp).toISOString())
  }

  const credentials = Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString("base64")
  const res = await fetch(`${LANGFUSE_BASE}/api/public/scores?${params.toString()}`, {
    headers: { Authorization: `Basic ${credentials}` },
  })

  if (!res.ok) {
    throw new Error(`Langfuse scores API returned ${res.status}: ${await res.text()}`)
  }

  return res.json() as Promise<{ data: Array<{ traceId: string; name: string; value: number; id: string }>; meta: unknown }>
}

export async function shutdownLangfuse() {
  await langfuse.flush()
}
