import { generateObject } from 'ai'
import { z } from 'zod'

import { getLanguageModel } from '@/lib/ai/openrouter'
import { prisma } from '@/lib/prisma'
import type { AnalysisResult, ScoreDimension } from '@/lib/rsil/analyzer'

const GENERATOR_MODEL = 'openai/gpt-4o'

const outputSchema = z.object({
  improvedPrompt: z.string().describe('The improved system prompt'),
  changelog: z.string().describe('Human-readable summary of changes made and why'),
})

const DIMENSION_MEANINGS: Record<string, string> = {
  'user-rating': 'Overall end-user satisfaction with the response quality.',
  helpfulness: 'How useful and action-oriented the response is for the user.',
  correctness: 'Factual and logical accuracy of statements and recommendations.',
  'context-relevance': 'How well the response adheres to user context and constraints.',
  hallucination: 'Tendency to invent unsupported facts; lower hallucination is better.',
  toxicity: 'Safety and respectful tone; lower toxicity is better.',
  conciseness: 'Ability to be clear and concise without losing essential detail.',
}

export interface GenerationResult {
  improvedPrompt: string
  changelog: string
  model: string
  tokensUsed: number
}

function formatDimensionScores(dimensions: AnalysisResult['dimensions']): string {
  if (dimensions.length === 0) {
    return '- No dimension scores available.'
  }

  return dimensions
    .map((dimension) => {
      const meaning = DIMENSION_MEANINGS[dimension.name] ?? 'General quality signal.'
      const percent = (dimension.avgValue * 100).toFixed(1)
      return `- ${dimension.name}: ${percent}% (samples=${dimension.sampleSize}, weight=${dimension.weight}) — ${meaning}`
    })
    .join('\n')
}

function formatWeakDimensions(weakDimensions: string[]): string {
  if (weakDimensions.length === 0) {
    return '- No weak dimensions identified.'
  }

  return weakDimensions
    .map((dimension) => `- ${dimension}: ${DIMENSION_MEANINGS[dimension] ?? 'General quality signal.'}`)
    .join('\n')
}

export async function generateImprovedPrompt(params: {
  webletId: string
  currentPrompt: string
  weakDimensions: string[]
  compositeScore: number
  dimensions: ScoreDimension[]
}): Promise<GenerationResult> {
  try {
    const model = getLanguageModel(GENERATOR_MODEL)

    const weakDimensionsSummary = formatWeakDimensions(params.weakDimensions)
    const dimensionScoreSummary = formatDimensionScores(params.dimensions)

    const result = await generateObject({
      model,
      schema: outputSchema,
      system: [
        'You are an expert AI prompt engineer specializing in improving system prompts.',
        "PRESERVE the weblet's core identity, persona, and purpose completely. Only improve the identified weak areas.",
        'Do NOT change the weblet\'s name, role description, or fundamental purpose.',
        'Add specific examples for low-scoring dimensions. Add guardrails for identified failure modes.',
        'Use the weak dimensions context below and their meanings to target improvements precisely:',
        weakDimensionsSummary,
      ].join('\n\n'),
      prompt: [
        'Improve the following system prompt while preserving its core behavior.',
        `Current composite score: ${(params.compositeScore * 100).toFixed(1)}%`,
        'Weak dimensions:',
        weakDimensionsSummary,
        'Per-dimension scores and meanings:',
        dimensionScoreSummary,
        'Current prompt (preserve persona/identity/purpose):',
        '<<<CURRENT_PROMPT_START>>>',
        params.currentPrompt,
        '<<<CURRENT_PROMPT_END>>>',
      ].join('\n\n'),
    })

    const totalTokens = result.usage?.totalTokens ?? 0
    const tracesEstimated = params.dimensions.length > 0
      ? Math.max(...params.dimensions.map((dimension) => dimension.sampleSize))
      : 0

    await prisma.evaluationRun.create({
      data: {
        webletId: params.webletId,
        tracesSampled: tracesEstimated,
        tracesEvaluated: tracesEstimated,
        dimensions: params.dimensions as any,
        compositeScore: params.compositeScore,
        judgeModel: GENERATOR_MODEL,
        status: 'COMPLETED',
        creditsUsed: Math.ceil(totalTokens / 1000),
        completedAt: new Date(),
      },
    })

    return {
      improvedPrompt: result.object.improvedPrompt,
      changelog: result.object.changelog,
      model: GENERATOR_MODEL,
      tokensUsed: totalTokens,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error('Prompt generation failed: ' + message)
  }
}
