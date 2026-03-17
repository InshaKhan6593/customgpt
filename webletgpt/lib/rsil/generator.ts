/**
 * RSIL Generator — uses GPT-4o to generate an improved prompt version
 * based on weak traces from Langfuse.
 */

import { generateText } from 'ai'
import { getLanguageModel } from '@/lib/ai/openrouter'
import { fetchTraces } from '@/lib/langfuse/client'
import { logUsage } from '@/lib/billing/usage-logger'
import { RSIL_CREDIT_COST } from '@/lib/billing/pricing'

const DIMENSION_HINTS: Record<string, string> = {
  'user-rating':   'Users rated these conversations poorly — address overall response quality and satisfaction.',
  'helpfulness':   'LLM judge flagged LOW HELPFULNESS — responses are not solving user problems effectively.',
  'correctness':   'LLM judge flagged LOW CORRECTNESS — responses contain factual errors or wrong answers.',
  'hallucination': 'LLM judge flagged HIGH HALLUCINATION — the AI is making up facts not grounded in context.',
  'toxicity':      'LLM judge flagged HIGH TOXICITY — responses contain inappropriate or harmful content.',
  'conciseness':   'LLM judge flagged LOW CONCISENESS — responses are too verbose or padded with unnecessary content.',
}

export async function generateImprovedPrompt({
  currentPrompt,
  webletId,
  lowScoredTraceIds,
  weakDimensions = [],
  webletName,
  webletDescription,
  developerId,
}: {
  currentPrompt: string
  webletId: string
  lowScoredTraceIds: string[]
  weakDimensions?: string[]
  webletName: string
  webletDescription?: string | null
  developerId: string
}): Promise<string> {
  const tracesData = await fetchTraces({ webletId, limit: 10 })
  const traces = tracesData?.data || []

  const lowTraces = traces.filter(t => lowScoredTraceIds.includes(t.id)).slice(0, 5)

  const examplesText = lowTraces.length > 0
    ? lowTraces.map((t, i) => {
        const input = typeof t.input === "string" ? t.input : "(unknown)"
        const output = typeof t.output === "string" ? t.output.slice(0, 300) : ""
        return `Example ${i + 1}:\nUser: ${input}\nAssistant: ${output}`
      }).join('\n\n')
    : 'No specific examples available — optimize based on common failure patterns.'

  const dimensionGuidance = weakDimensions.length > 0
    ? '\n\nSPECIFIC WEAKNESSES IDENTIFIED BY LLM EVALUATORS:\n' +
      weakDimensions.map(d => `• ${DIMENSION_HINTS[d] || `Low score on "${d}" — address this specifically.`}`).join('\n')
    : ''

  const model = getLanguageModel('openai/gpt-4o')

  const { text, usage } = await generateText({
    model,
    system: `You are a ruthless AI performance critic and prompt engineer. Your job is to rewrite system prompts to fix specific weaknesses. Be direct, specific, and harsh. Make the prompt significantly better.`,
    prompt: `You are optimizing a weblet called "${webletName}" (${webletDescription || 'an AI assistant'}).

CURRENT SYSTEM PROMPT:
${currentPrompt}
${dimensionGuidance}

WEAK CONVERSATIONS (low-scored by users and/or LLM evaluators):
${examplesText}

Rewrite the system prompt to fix these weaknesses. Rules:
1. Keep the core purpose and persona identical
2. Directly address each identified weakness from the evaluator feedback above
3. Add specific examples where the AI was vague
4. Add guardrails where the AI went off-topic or hallucinated
5. Improve tone/persona where it felt wrong
6. Add clarifying instructions for the most common failure patterns

Return ONLY the new system prompt text, no explanation.`,
  })

  try {
    await logUsage({
      userId: developerId,
      webletId,
      developerId,
      tokensIn: usage?.inputTokens ?? 0,
      tokensOut: usage?.outputTokens ?? 0,
      modelId: 'openai/gpt-4o',
      toolCalls: { base: RSIL_CREDIT_COST },
      source: 'RSIL',
    })
  } catch (err) {
    console.error('[RSIL] Failed to log usage:', err)
  }

  return text.trim()
}
