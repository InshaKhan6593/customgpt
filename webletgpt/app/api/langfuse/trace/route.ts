import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const querySchema = z.object({
  traceId: z.string().min(1),
  webletId: z.string().min(1),
})

const LANGFUSE_BASE = process.env.LANGFUSE_BASE || process.env.LANGFUSE_BASE_URL || process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com'
const LANGFUSE_SECRET = process.env.LANGFUSE_SECRET_KEY
const LANGFUSE_PUBLIC = process.env.LANGFUSE_PUBLIC_KEY

function getLangfuseAuthHeader(): string {
  if (!LANGFUSE_PUBLIC || !LANGFUSE_SECRET) {
    throw new Error('Langfuse credentials are not configured')
  }

  return `Basic ${Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString("base64")}`
}

interface LangfuseTrace {
  id: string
  input?: unknown
  output?: unknown
  timestamp?: string
  tags?: string[]
  scores?: Array<{
    id: string
    name: string
    value: number
  }>
}

interface SanitizedTrace {
  inputText: string | null
  outputText: string | null
  timestamp: string
  score?: number
}

interface LangfuseTraceApiResponse {
  data?: unknown
}

function isLangfuseTrace(value: unknown): value is LangfuseTrace {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'string'
}

function normalizeLangfuseTrace(payload: unknown): LangfuseTrace | undefined {
  if (isLangfuseTrace(payload)) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as LangfuseTraceApiResponse
    if (isLangfuseTrace(candidate.data)) {
      return candidate.data
    }
  }

  return undefined
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const developerId = session.user.id

  try {
    const parsed = querySchema.safeParse({
      traceId: req.nextUrl.searchParams.get("traceId"),
      webletId: req.nextUrl.searchParams.get("webletId"),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query params' }, { status: 400 })
    }

    const { traceId, webletId } = parsed.data

    // Verify ownership
    const weblet = await prisma.weblet.findFirst({
      where: { id: webletId, developerId },
      select: { id: true },
    })

    if (!weblet) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch trace from Langfuse
    const res = await fetch(`${LANGFUSE_BASE}/api/public/traces/${traceId}`, {
      headers: { Authorization: getLangfuseAuthHeader() },
    })

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Trace not found' }, { status: 404 })
      }
      console.error(`Langfuse trace API returned ${res.status}: ${await res.text()}`)
      return NextResponse.json({ error: 'Failed to fetch trace' }, { status: 500 })
    }

    const payload = (await res.json()) as unknown
    const trace = normalizeLangfuseTrace(payload)

    if (!trace) {
      return NextResponse.json({ error: 'Trace not found' }, { status: 404 })
    }

    // Enforce IDOR protection: verify trace belongs to this weblet
    const expectedTag = `webletId:${webletId}`
    if (!trace.tags || !trace.tags.includes(expectedTag)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Sanitize and extract fields
    const sanitized: SanitizedTrace = {
      inputText: extractText(trace.input),
      outputText: extractText(trace.output),
      timestamp: trace.timestamp || new Date().toISOString(),
    }

    // Extract score if present
    if (trace.scores && trace.scores.length > 0) {
      // Use first score value (could be extended to filter by name)
      sanitized.score = trace.scores[0].value
    }

    return NextResponse.json(sanitized)
  } catch (error) {
    console.error('Langfuse trace fetch error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function extractText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object') {
    // Handle structured objects (e.g., {text: "...", messages: [...]} or {content: "..."})
    const obj = value as Record<string, unknown>
    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text
    }
    if ('content' in obj && typeof obj.content === 'string') {
      return obj.content
    }
    if ('messages' in obj && Array.isArray(obj.messages)) {
      // Extract message content if exists
      const texts = obj.messages
        .map((m: unknown) => {
          if (m && typeof m === 'object' && 'content' in m) {
            return String(m.content)
          }
          return null
        })
        .filter(Boolean)
      return texts.length > 0 ? texts.join('\n') : null
    }
  }
  return null
}
