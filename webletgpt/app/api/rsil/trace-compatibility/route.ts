import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"

const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com"
const LANGFUSE_PUBLIC = process.env.LANGFUSE_PUBLIC_KEY!
const LANGFUSE_SECRET = process.env.LANGFUSE_SECRET_KEY!

function getLangfuseAuthHeader(): string {
  return `Basic ${Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString("base64")}`
}

interface LangfuseTraceListItem {
  id: string
  input: unknown
  output: unknown
  metadata: unknown
  tags?: string[]
}

interface LangfuseTracesResponse {
  data: LangfuseTraceListItem[]
  meta?: unknown
}

const getQuerySchema = z.object({
  webletId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const parsed = getQuerySchema.safeParse({
      webletId: req.nextUrl.searchParams.get("webletId"),
    })

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query params" }, { status: 400 })
    }

    const { webletId } = parsed.data

    const params = new URLSearchParams()
    params.set("limit", "100")
    params.set("page", "1")
    params.set("tags", `webletId:${webletId}`)

    const res = await fetch(`${LANGFUSE_BASE}/api/public/traces?${params.toString()}`, {
      headers: { Authorization: getLangfuseAuthHeader() },
    })

    if (!res.ok) {
      console.error(`[trace-compatibility] Langfuse traces API returned ${res.status} for weblet ${webletId}`)
      return NextResponse.json({ error: "Failed to fetch traces from Langfuse" }, { status: 502 })
    }

    const json = (await res.json()) as LangfuseTracesResponse
    const traces = json.data ?? []

    const sampleSize = traces.length

    if (sampleSize === 0) {
      return NextResponse.json({
        hasInput: false,
        hasOutput: false,
        hasContext: false,
        contextPresencePercent: 0,
        sampleSize: 0,
      })
    }

    let inputCount = 0
    let outputCount = 0
    let contextCount = 0

    for (const trace of traces) {
      if (trace.input !== null && trace.input !== undefined && trace.input !== "") {
        inputCount++
      }
      if (trace.output !== null && trace.output !== undefined && trace.output !== "") {
        outputCount++
      }
      if (
        trace.metadata !== null &&
        trace.metadata !== undefined &&
        typeof trace.metadata === "object" &&
        "context" in (trace.metadata as Record<string, unknown>) &&
        (trace.metadata as Record<string, unknown>).context !== null &&
        (trace.metadata as Record<string, unknown>).context !== undefined
      ) {
        contextCount++
      }
    }

    const contextPresencePercent = (contextCount / sampleSize) * 100

    return NextResponse.json({
      hasInput: inputCount > 0,
      hasOutput: outputCount > 0,
      hasContext: contextPresencePercent > 50,
      contextPresencePercent,
      sampleSize,
    })
  } catch (error) {
    console.error("[trace-compatibility] GET error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
