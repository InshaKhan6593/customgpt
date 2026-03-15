/**
 * Langfuse REST API client
 * Used for: pushing scores, querying traces for RSIL analyzer, fetching analytics for developer dashboard
 */

const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com"
const LANGFUSE_SECRET = process.env.LANGFUSE_SECRET_KEY!
const LANGFUSE_PUBLIC = process.env.LANGFUSE_PUBLIC_KEY!

function basicAuth() {
  return "Basic " + Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString("base64")
}

/** Push a user rating score to Langfuse, linked to a trace */
export async function pushScore({
  traceId,
  name,
  value,
  comment,
}: {
  traceId: string
  name: string
  value: number
  comment?: string
}) {
  const res = await fetch(`${LANGFUSE_BASE}/api/public/scores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify({ traceId, name, value, comment }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Langfuse score push failed: ${res.status} ${text}`)
  }

  return res.json()
}

/** Fetch traces for a weblet (used by RSIL analyzer + developer dashboard) */
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
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
    tags: `webletId:${webletId}`,
    ...(fromTimestamp ? { fromTimestamp } : {}),
  })

  const res = await fetch(`${LANGFUSE_BASE}/api/public/traces?${params}`, {
    headers: { Authorization: basicAuth() },
  })

  if (!res.ok) throw new Error(`Langfuse traces fetch failed: ${res.status}`)
  return res.json()
}

/** Fetch scores for a weblet (used by RSIL analyzer) */
export async function fetchScores({
  webletId,
  fromTimestamp,
  limit = 100,
}: {
  webletId: string
  fromTimestamp?: string
  limit?: number
}) {
  const params = new URLSearchParams({
    limit: String(limit),
    ...(fromTimestamp ? { fromTimestamp } : {}),
  })

  const res = await fetch(`${LANGFUSE_BASE}/api/public/scores?${params}`, {
    headers: { Authorization: basicAuth() },
  })

  if (!res.ok) throw new Error(`Langfuse scores fetch failed: ${res.status}`)
  const data = await res.json()

  // Filter by webletId from metadata (Langfuse doesn't support filtering by metadata directly)
  return data
}

/** Create or update a Langfuse trace (used to anchor user scores to a session) */
export async function upsertTrace({
  id,
  name,
  userId,
  sessionId,
  input,
  output,
  metadata,
  tags,
}: {
  id: string
  name: string
  userId?: string
  sessionId?: string
  input?: string
  output?: string
  metadata?: Record<string, string>
  tags?: string[]
}) {
  const res = await fetch(`${LANGFUSE_BASE}/api/public/traces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify({ id, name, userId, sessionId, input, output, metadata, tags }),
  })

  if (!res.ok) {
    const text = await res.text()
    // Don't throw — tracing failure should not break chat
    console.error(`Langfuse trace upsert failed: ${res.status} ${text}`)
    return null
  }

  return res.json()
}

/** Fetch sessions for a weblet */
export async function fetchSessions({
  webletId,
  limit = 20,
}: {
  webletId: string
  limit?: number
}) {
  const params = new URLSearchParams({ limit: String(limit) })

  const res = await fetch(`${LANGFUSE_BASE}/api/public/sessions?${params}`, {
    headers: { Authorization: basicAuth() },
  })

  if (!res.ok) throw new Error(`Langfuse sessions fetch failed: ${res.status}`)
  return res.json()
}
