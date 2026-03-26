/**
 * LLM-as-Judge evaluation service using gpt-4o-mini.
 *
 * Runs enabled evaluators against a trace (input/output/context),
 * posts scores to Langfuse via createLangfuseScore(), and returns
 * the collected EvaluationResult[]. Designed for batch/async use only —
 * never call from the hot chat path.
 */

import OpenAI from 'openai'
import { EVALUATOR_PROMPTS, CONTEXT_EVALUATORS } from './evaluator-prompts'
import { createLangfuseScore } from '@/lib/langfuse/client'

// ─── Constants ───────────────────────────────────────────────────────────────

const JUDGE_MODEL = 'gpt-4o-mini'
const MAX_RETRIES = 3
const BACKOFF_DELAYS_MS = [1000, 2000, 4000] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvaluationResult {
  /** Evaluator name, e.g. "helpfulness" */
  evaluatorName: string
  /** Clamped 0.0–1.0 */
  score: number
  /** LLM's step-by-step reasoning */
  reasoning: string
  /** Langfuse trace ID this result belongs to */
  traceId: string
}

interface EvaluateTraceParams {
  traceId: string
  input: string
  output: string
  /** System prompt / retrieved context. Context-based evaluators are skipped when undefined. */
  context?: string
  /** Evaluator names to run. If omitted, all evaluators are run (subject to context gating). */
  enabledEvaluators?: string[]
}

interface EvaluateBatchParams {
  traces: EvaluateTraceParams[]
}

// ─── Injectable dependencies (test seam) ─────────────────────────────────────

type OpenAILike = {
  chat: {
    completions: {
      create: (params: {
        model: string
        response_format: { type: string }
        messages: Array<{ role: string; content: string }>
      }) => Promise<{ choices: Array<{ message: { content: string | null } }> }>
    }
  }
}

let _openaiInstance: OpenAILike | null = null
let _sleepFn: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms))

export function _setOpenAIForTesting(client: OpenAILike): void {
  _openaiInstance = client
}

export function _setSleepForTesting(fn: (ms: number) => Promise<void>): void {
  _sleepFn = fn
}

export function _resetInternals(): void {
  _openaiInstance = null
  _sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}

function getOpenAI(): OpenAILike {
  if (!_openaiInstance) {
    _openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as unknown as OpenAILike
  }
  return _openaiInstance
}

/** Replace prompt placeholders with actual values. */
function fillPrompt(
  template: string,
  input: string,
  output: string,
  context?: string
): string {
  return template
    .replace('{{input}}', input)
    .replace('{{output}}', output)
    .replace('{{context}}', context ?? '')
}

/** Clamp a number to [0.0, 1.0]. */
function clamp(value: number): number {
  return Math.min(1.0, Math.max(0.0, value))
}

/**
 * Call gpt-4o-mini with JSON mode, retrying up to 3× with exponential backoff.
 * Returns `{ score, reasoning }` or throws after all retries are exhausted.
 */
async function callJudge(
  promptText: string
): Promise<{ score: number; reasoning: string }> {
  const openai = getOpenAI()
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BACKOFF_DELAYS_MS[attempt - 1] ?? 4000
      await _sleepFn(delay)
    }

    try {
      const completion = await openai.chat.completions.create({
        model: JUDGE_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: promptText,
          },
        ],
      })

      const raw = completion.choices[0]?.message?.content
      if (!raw) {
        throw new Error('Empty response from judge model')
      }

      const parsed = JSON.parse(raw) as unknown

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as Record<string, unknown>).score !== 'number' ||
        typeof (parsed as Record<string, unknown>).reasoning !== 'string'
      ) {
        throw new Error(
          `Judge returned malformed JSON: missing score or reasoning. Got: ${raw.slice(0, 200)}`
        )
      }

      const { score, reasoning } = parsed as { score: number; reasoning: string }
      return { score: clamp(score), reasoning }
    } catch (err) {
      lastError = err
      console.warn(
        `[evaluator] Attempt ${attempt + 1}/${MAX_RETRIES} failed for judge call:`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run enabled evaluators against a single trace.
 *
 * - Context-based evaluators are automatically skipped when `context` is undefined.
 * - If one evaluator fails after all retries, a warning is logged and the loop
 *   continues — no error propagates out.
 * - Successful scores are posted to Langfuse via `createLangfuseScore()`.
 *
 * @returns Array of successful EvaluationResult objects (failures are omitted).
 */
export async function evaluateTrace(params: EvaluateTraceParams): Promise<EvaluationResult[]> {
  const { traceId, input, output, context, enabledEvaluators } = params

  // Determine which evaluators to run
  const candidateNames = enabledEvaluators ?? Object.keys(EVALUATOR_PROMPTS)
  const results: EvaluationResult[] = []

  for (const evaluatorName of candidateNames) {
    const promptConfig = EVALUATOR_PROMPTS[evaluatorName]

    if (!promptConfig) {
      console.warn(`[evaluator] Unknown evaluator "${evaluatorName}" — skipping`)
      continue
    }

    // Skip context-based evaluators when context is not provided
    if (CONTEXT_EVALUATORS.includes(evaluatorName) && context === undefined) {
      continue
    }

    const filledPrompt = fillPrompt(promptConfig.prompt, input, output, context)

    try {
      const { score, reasoning } = await callJudge(filledPrompt)

      const result: EvaluationResult = {
        evaluatorName,
        score,
        reasoning,
        traceId,
      }

      results.push(result)

      // Fire-and-forget score posting; don't let failures break the loop
      try {
        await createLangfuseScore({
          traceId,
          name: evaluatorName,
          value: score,
          comment: reasoning,
        })
      } catch (scoreErr) {
        console.warn(
          `[evaluator] Failed to post score for "${evaluatorName}" on trace "${traceId}":`,
          scoreErr instanceof Error ? scoreErr.message : String(scoreErr)
        )
      }
    } catch (evalErr) {
      // One evaluator failing must not break others
      console.warn(
        `[evaluator] Evaluator "${evaluatorName}" failed for trace "${traceId}" after ${MAX_RETRIES} retries:`,
        evalErr instanceof Error ? evalErr.message : String(evalErr)
      )
    }
  }

  return results
}

/**
 * Bulk-evaluate a list of traces sequentially.
 *
 * Processes traces one at a time to avoid rate-limit spikes.
 * Failures on individual traces are caught and logged — they do not abort the batch.
 *
 * @returns Flat array of all successful EvaluationResult objects across all traces.
 */
export async function evaluateBatch(params: EvaluateBatchParams): Promise<EvaluationResult[]> {
  const allResults: EvaluationResult[] = []

  for (const traceParams of params.traces) {
    try {
      const traceResults = await evaluateTrace(traceParams)
      allResults.push(...traceResults)
    } catch (err) {
      // evaluateTrace should not throw, but guard defensively
      console.warn(
        `[evaluator] Unexpected error for trace "${traceParams.traceId}":`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return allResults
}
