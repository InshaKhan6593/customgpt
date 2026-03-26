/**
 * RSIL Evaluation Cron — Hourly batch evaluation via LLM-as-Judge.
 *
 * Runs every hour, finds RSIL-enabled weblets, fetches recent traces from
 * Langfuse that lack evaluation scores, applies 10% random sampling to
 * control LLM costs, then runs evaluateBatch() for each weblet.
 */

import { inngest } from '@/lib/inngest/client'
import { prisma } from '@/lib/prisma'
import { evaluateBatch } from '@/lib/rsil/evaluator'
import { getGovernance, DEFAULT_EVALUATOR_CONFIG, EvaluatorConfig } from '@/lib/rsil/governance'

// ─── Constants ───────────────────────────────────────────────────────────────

const EVALUATION_LOOKBACK_HOURS = 1
const SAMPLING_RATE = 0.1
const LANGFUSE_BASE = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'
const LANGFUSE_PUBLIC = process.env.LANGFUSE_PUBLIC_KEY!
const LANGFUSE_SECRET = process.env.LANGFUSE_SECRET_KEY!
const LANGFUSE_MAX_TRACES = 100

// ─── Types ────────────────────────────────────────────────────────────────────

interface LangfuseTraceListItem {
  id: string
  input: unknown
  output: unknown
  metadata: unknown
  scores?: Array<{ name: string; value: number }>
  tags?: string[]
  timestamp?: string
}

interface LangfuseTracesResponse {
  data: LangfuseTraceListItem[]
  meta?: unknown
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLangfuseAuthHeader(): string {
  return `Basic ${Buffer.from(`${LANGFUSE_PUBLIC}:${LANGFUSE_SECRET}`).toString('base64')}`
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('text' in obj && typeof obj.text === 'string') return obj.text
    if ('content' in obj && typeof obj.content === 'string') return obj.content
    if ('messages' in obj && Array.isArray(obj.messages)) {
      const last = obj.messages[obj.messages.length - 1] as Record<string, unknown> | undefined
      if (last && typeof last.content === 'string') return last.content
    }
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }
  return ''
}

function extractContext(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const meta = metadata as Record<string, unknown>
  if (typeof meta.context === 'string') return meta.context
  if (typeof meta.systemPrompt === 'string') return meta.systemPrompt
  return undefined
}

/**
 * Build the list of evaluator names to run based on the governance config.
 * Base evaluators are always included. Optional evaluators only when enabled.
 */
function getEnabledEvaluators(config: EvaluatorConfig): string[] {
  const evaluators: string[] = []

  for (const name of Object.keys(config.baseEvaluators)) {
    evaluators.push(name)
  }

  for (const [name, entry] of Object.entries(config.optionalEvaluators)) {
    if (entry.enabled) {
      evaluators.push(name)
    }
  }

  return evaluators
}

/**
 * Fetch recent traces for a weblet from Langfuse that do NOT yet have
 * evaluation scores (i.e., none of the base evaluators have been scored).
 *
 * Uses /api/public/traces with tag filtering and fromTimestamp.
 */
async function fetchUnevaluatedTraces(
  webletId: string,
  fromTimestamp: Date,
): Promise<LangfuseTraceListItem[]> {
  const params = new URLSearchParams()
  params.set('limit', String(LANGFUSE_MAX_TRACES))
  params.set('page', '1')
  params.set('tags', `webletId:${webletId}`)
  params.set('fromTimestamp', fromTimestamp.toISOString())

  try {
    const res = await fetch(`${LANGFUSE_BASE}/api/public/traces?${params.toString()}`, {
      headers: { Authorization: getLangfuseAuthHeader() },
    })

    if (!res.ok) {
      console.warn(
        `[rsil-evaluation] Langfuse traces API returned ${res.status} for weblet ${webletId}`,
      )
      return []
    }

    const json = (await res.json()) as LangfuseTracesResponse
    const traces = json.data ?? []

    const BASE_EVALUATOR_NAMES = new Set(['helpfulness', 'correctness', 'hallucination'])

    return traces.filter((trace) => {
      if (!trace.scores || trace.scores.length === 0) return true
      const scoredNames = new Set(trace.scores.map((s) => s.name))
      return !BASE_EVALUATOR_NAMES.has([...scoredNames].find((n) => BASE_EVALUATOR_NAMES.has(n)) ?? '')
    })
  } catch (err) {
    console.warn(`[rsil-evaluation] Failed to fetch traces for weblet ${webletId}:`, err)
    return []
  }
}

// ─── Cron Function ────────────────────────────────────────────────────────────

export const rsilEvaluationCron = inngest.createFunction(
  { id: 'rsil-evaluation-cron' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const now = new Date()
    const fromTimestamp = new Date(now.getTime() - EVALUATION_LOOKBACK_HOURS * 60 * 60 * 1000)

    const weblets = await step.run('load-rsil-enabled-weblets', async () => {
      return prisma.weblet.findMany({
        where: { rsilEnabled: true },
        select: {
          id: true,
          name: true,
          rsilGovernance: true,
        },
      })
    })

    let evaluatedCount = 0
    let sampledCount = 0
    let skippedCount = 0

    for (const weblet of weblets) {
      const governance = getGovernance({ rsilGovernance: weblet.rsilGovernance })
      const evaluatorConfig = governance.evaluatorConfig ?? DEFAULT_EVALUATOR_CONFIG
      const enabledEvaluators = getEnabledEvaluators(evaluatorConfig)

      const results = await step.run(`evaluate-traces-${weblet.id}`, async () => {
        const traces = await fetchUnevaluatedTraces(weblet.id, fromTimestamp)

        if (traces.length === 0) {
          return { evaluated: 0, sampled: 0, skipped: 0 }
        }

        const sampledTraces = traces.filter(() => Math.random() < SAMPLING_RATE)

        if (sampledTraces.length === 0) {
          return { evaluated: 0, sampled: 0, skipped: traces.length }
        }

        const traceParams = sampledTraces.map((trace) => ({
          traceId: trace.id,
          input: extractText(trace.input),
          output: extractText(trace.output),
          context: extractContext(trace.metadata),
          enabledEvaluators,
        }))

        await evaluateBatch({ traces: traceParams })

        return {
          evaluated: traceParams.length,
          sampled: sampledTraces.length,
          skipped: traces.length - sampledTraces.length,
        }
      })

      evaluatedCount += results.evaluated
      sampledCount += results.sampled
      skippedCount += results.skipped
    }

    return {
      success: true,
      scanned: weblets.length,
      evaluated: evaluatedCount,
      sampled: sampledCount,
      skipped: skippedCount,
    }
  },
)
