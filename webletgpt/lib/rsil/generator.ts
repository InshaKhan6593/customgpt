/**
 * RSIL Generator — uses GPT-4o to generate an improved prompt version
 * based on weak traces from Langfuse.
 */

import { generateText } from 'ai'
import { getLanguageModel } from '@/lib/ai/openrouter'
import { fetchTraces } from '@/lib/langfuse/client'

export async function generateImprovedPrompt({
  currentPrompt,
  webletId,
  lowScoredTraceIds,
  webletName,
  webletDescription,
}: {
  currentPrompt: string
  webletId: string
  lowScoredTraceIds: string[]
  webletName: string
  webletDescription?: string | null
}): Promise<string> {
  // Fetch some low-scored traces for context
  const tracesData = await fetchTraces({ webletId, limit: 10 })
  const traces: Array<{ input?: string; output?: string; id: string }> = tracesData?.data || []

  const lowTraces = traces.filter(t => lowScoredTraceIds.includes(t.id)).slice(0, 5)

  const examplesText = lowTraces.length > 0
    ? lowTraces.map((t, i) =>
        `Example ${i + 1}:\nUser: ${t.input || '(unknown)'}\nAssistant: ${(t.output || '').slice(0, 300)}`
      ).join('\n\n')
    : 'No specific examples available — optimize based on common failure patterns.'

  const model = getLanguageModel('openai/gpt-4o')

  const { text } = await generateText({
    model,
    system: `You are a ruthless AI performance critic and prompt engineer. Your job is to rewrite system prompts to fix specific weaknesses. Be direct, specific, and harsh. Make the prompt significantly better.`,
    prompt: `You are optimizing a weblet called "${webletName}" (${webletDescription || 'an AI assistant'}).

CURRENT SYSTEM PROMPT:
${currentPrompt}

WEAK CONVERSATIONS (users rated these poorly):
${examplesText}

Rewrite the system prompt to fix these weaknesses. Rules:
1. Keep the core purpose and persona identical
2. Add specific examples where the AI was vague
3. Add guardrails where the AI went off-topic
4. Improve tone/persona where it felt wrong
5. Add clarifying instructions for the most common failure patterns

Return ONLY the new system prompt text, no explanation.`,
  })

  return text.trim()
}
