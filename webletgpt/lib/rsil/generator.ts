import { generateObject } from 'ai'
import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { getLanguageModel } from '@/lib/ai/openrouter'
import { prisma } from '@/lib/prisma'
import type { AnalysisResult, ScoreDimension } from '@/lib/rsil/analyzer'

const GENERATOR_MODEL = 'openai/gpt-4o'
const PERCENT_SCALE = 100
const PERCENT_DECIMAL_PLACES = 1
const SCORE_DECIMAL_PLACES = 3
const MAX_PROMPT_LENGTH_MULTIPLIER = 2
const TOKENS_PER_CREDIT = 1000

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

type ConversationExample = {
  traceId: string
  conversation: string
  score: number
  weakDimensions: string[]
}

function formatDimensionScores(dimensions: AnalysisResult['dimensions']): string {
  if (dimensions.length === 0) {
    return '- No dimension scores available.'
  }

  return dimensions
    .map((dimension) => {
      const meaning = DIMENSION_MEANINGS[dimension.name] ?? 'General quality signal.'
      const percent = (dimension.avgValue * PERCENT_SCALE).toFixed(PERCENT_DECIMAL_PLACES)
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

function formatConversationExamples(examples: ConversationExample[]): string {
  return examples
    .map((example) => {
      const weakDimensions = example.weakDimensions.length > 0
        ? example.weakDimensions.join(', ')
        : 'none'

      return [
        `- traceId: ${example.traceId}`,
        `  score: ${example.score.toFixed(SCORE_DECIMAL_PLACES)}`,
        `  weakDimensions: ${weakDimensions}`,
        '  conversation:',
        example.conversation,
      ].join('\n')
    })
    .join('\n\n')
}

export async function generateImprovedPrompt(params: {
  webletId: string
  currentPrompt: string
  weakDimensions: string[]
  compositeScore: number
  dimensions: ScoreDimension[]
  badExamples?: ConversationExample[]
  goodExamples?: ConversationExample[]
}): Promise<GenerationResult> {
  try {
    const model = getLanguageModel(GENERATOR_MODEL)
    const hasBadExamples = Boolean(params.badExamples && params.badExamples.length > 0)
    const hasGoodExamples = Boolean(params.goodExamples && params.goodExamples.length > 0)
    const hasConversationExamples = hasBadExamples || hasGoodExamples

    const weakDimensionsSummary = formatWeakDimensions(params.weakDimensions)
    const dimensionScoreSummary = formatDimensionScores(params.dimensions)
    const promptSections = [
      'Improve the following system prompt while preserving its core behavior.',
      `Current composite score: ${(params.compositeScore * PERCENT_SCALE).toFixed(PERCENT_DECIMAL_PLACES)}%`,
      'Weak dimensions:',
      weakDimensionsSummary,
      'Per-dimension scores and meanings:',
      dimensionScoreSummary,
      hasConversationExamples
        ? 'When writing `changelog`, explicitly cite concrete recurring conversation patterns from the provided examples (failure modes, response issues, or missing behaviors) and tie each cited pattern to a prompt change.'
        : 'When writing `changelog`, summarize changes and rationale based on the score/dimension context only; do not invent conversation-pattern references.',
    ]

    if (params.badExamples && params.badExamples.length > 0) {
      promptSections.push(
        'Low-scoring conversation examples (what to fix):',
        formatConversationExamples(params.badExamples)
      )
    }

    if (params.goodExamples && params.goodExamples.length > 0) {
      promptSections.push(
        'High-scoring conversation examples (what to preserve):',
        formatConversationExamples(params.goodExamples)
      )
    }

    promptSections.push(
      'Current prompt (preserve persona/identity/purpose):',
      '<<<CURRENT_PROMPT_START>>>',
      params.currentPrompt,
      '<<<CURRENT_PROMPT_END>>>'
    )

    const result = await generateObject({
      model,
      schema: outputSchema,
      system: [
        'You are an expert AI prompt engineer specializing in improving system prompts.',
        "PRESERVE the weblet's core identity, persona, and purpose completely. Only improve the identified weak areas.",
        'Do NOT change the weblet\'s name, role description, or fundamental purpose.',
        'Add specific examples for low-scoring dimensions. Add guardrails for identified failure modes.',
        hasConversationExamples
          ? 'If conversation examples are provided, the `changelog` MUST reference concrete patterns observed in those examples (recurring failure mode, response issue, or missing behavior) and map each pattern to a specific prompt update.'
          : 'If no conversation examples are provided, keep `changelog` grounded in the score/dimension context and avoid fabricated example references.',
        'Use the weak dimensions context below and their meanings to target improvements precisely:',
        weakDimensionsSummary,
      ].join('\n\n'),
      prompt: [
        ...promptSections,
      ].join('\n\n'),
    })

    const generatedPrompt = result.object.improvedPrompt
    const maxAllowedPromptLength = MAX_PROMPT_LENGTH_MULTIPLIER * params.currentPrompt.length

    if (generatedPrompt.length > maxAllowedPromptLength) {
      throw new Error(
        `Generated prompt length (${generatedPrompt.length}) exceeds safety limit (${maxAllowedPromptLength}). Reduce prompt bloat before deployment.`
      )
    }

    const totalTokens = result.usage?.totalTokens ?? 0
    const tracesEstimated = params.dimensions.length > 0
      ? Math.max(...params.dimensions.map((dimension) => dimension.sampleSize))
      : 0

    await prisma.evaluationRun.create({
      data: {
        webletId: params.webletId,
        tracesSampled: tracesEstimated,
        tracesEvaluated: tracesEstimated,
        dimensions: params.dimensions as unknown as Prisma.InputJsonValue,
        compositeScore: params.compositeScore,
        judgeModel: GENERATOR_MODEL,
        status: 'COMPLETED',
        creditsUsed: Math.ceil(totalTokens / TOKENS_PER_CREDIT),
        completedAt: new Date(),
      },
    })

    return {
      improvedPrompt: generatedPrompt,
      changelog: result.object.changelog,
      model: GENERATOR_MODEL,
      tokensUsed: totalTokens,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error('Prompt generation failed: ' + message)
  }
}
