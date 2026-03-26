import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test'
import {
  evaluateTrace,
  evaluateBatch,
  _setOpenAIForTesting,
  _setSleepForTesting,
  _resetInternals,
  type EvaluationResult,
} from './evaluator'

// ─── Langfuse mock ────────────────────────────────────────────────────────────

const mockCreateLangfuseScore = mock(async () => ({ id: 'score-id-123' }))

mock.module('@/lib/langfuse/client', () => ({
  createLangfuseScore: mockCreateLangfuseScore,
}))

// ─── OpenAI mock factory ──────────────────────────────────────────────────────

const noopSleep = async (_ms: number) => {}

function makeOpenAIClient(responses: Array<string | Error>): void {
  let callIndex = 0

  _setOpenAIForTesting({
    chat: {
      completions: {
        create: async () => {
          const response = responses[callIndex++]
          if (response instanceof Error) throw response
          return {
            choices: [{ message: { content: response } }],
          }
        },
      },
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRACE_ID = 'trace-abc-123'
const INPUT = 'How do I reverse a string in Python?'
const OUTPUT = "Use slicing: my_string[::-1]"
const CONTEXT = 'Python 3 documentation on strings'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('evaluateTrace', () => {
  beforeEach(() => {
    mockCreateLangfuseScore.mockClear()
    _resetInternals()
    _setSleepForTesting(noopSleep)
  })

  afterEach(() => {
    _resetInternals()
  })

  it('returns scores for enabled evaluators', async () => {
    makeOpenAIClient([
      '{"score": 0.9, "reasoning": "Very helpful response"}',
      '{"score": 0.85, "reasoning": "Factually accurate"}',
    ])

    const results = await evaluateTrace({
      traceId: TRACE_ID,
      input: INPUT,
      output: OUTPUT,
      enabledEvaluators: ['helpfulness', 'correctness'],
    })

    expect(results).toHaveLength(2)
    expect(results[0].evaluatorName).toBe('helpfulness')
    expect(results[0].score).toBe(0.9)
    expect(results[0].reasoning).toBe('Very helpful response')
    expect(results[0].traceId).toBe(TRACE_ID)
    expect(results[1].evaluatorName).toBe('correctness')
    expect(results[1].score).toBe(0.85)
  })

  it('skips context evaluators when context is undefined', async () => {
    makeOpenAIClient([
      '{"score": 0.8, "reasoning": "Helpful"}',
    ])

    const results = await evaluateTrace({
      traceId: TRACE_ID,
      input: INPUT,
      output: OUTPUT,
      context: undefined,
      enabledEvaluators: ['helpfulness', 'context-relevance', 'faithfulness'],
    })

    expect(results).toHaveLength(1)
    expect(results[0].evaluatorName).toBe('helpfulness')
  })

  it('retries on failure then succeeds', async () => {
    makeOpenAIClient([
      new Error('OpenAI 429 rate limit'),
      '{"score": 0.75, "reasoning": "Mostly correct"}',
    ])

    const results = await evaluateTrace({
      traceId: TRACE_ID,
      input: INPUT,
      output: OUTPUT,
      enabledEvaluators: ['correctness'],
    })

    expect(results).toHaveLength(1)
    expect(results[0].score).toBe(0.75)
  })

  it('continues when one evaluator fails after all retries', async () => {
    makeOpenAIClient([
      new Error('Persistent API error 1'),
      new Error('Persistent API error 2'),
      new Error('Persistent API error 3'),
      '{"score": 0.6, "reasoning": "Somewhat concise"}',
    ])

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    const results = await evaluateTrace({
      traceId: TRACE_ID,
      input: INPUT,
      output: OUTPUT,
      enabledEvaluators: ['helpfulness', 'conciseness'],
    })

    expect(results).toHaveLength(1)
    expect(results[0].evaluatorName).toBe('conciseness')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('posts scores to Langfuse on success', async () => {
    makeOpenAIClient([
      '{"score": 0.95, "reasoning": "Excellent response"}',
    ])

    await evaluateTrace({
      traceId: TRACE_ID,
      input: INPUT,
      output: OUTPUT,
      enabledEvaluators: ['helpfulness'],
    })

    expect(mockCreateLangfuseScore).toHaveBeenCalledTimes(1)
    expect(mockCreateLangfuseScore).toHaveBeenCalledWith({
      traceId: TRACE_ID,
      name: 'helpfulness',
      value: 0.95,
      comment: 'Excellent response',
    })
  })

  it('handles malformed JSON response gracefully', async () => {
    makeOpenAIClient([
      'not valid json at all',
      'also not json',
      'still not json',
    ])

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    const results = await evaluateTrace({
      traceId: TRACE_ID,
      input: INPUT,
      output: OUTPUT,
      enabledEvaluators: ['helpfulness'],
    })

    expect(results).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('clamps scores outside 0-1 range', async () => {
    makeOpenAIClient([
      '{"score": 1.5, "reasoning": "Over-scored"}',
      '{"score": -0.3, "reasoning": "Under-scored"}',
    ])

    const results = await evaluateTrace({
      traceId: TRACE_ID,
      input: INPUT,
      output: OUTPUT,
      enabledEvaluators: ['helpfulness', 'correctness'],
    })

    expect(results).toHaveLength(2)
    expect(results[0].score).toBe(1.0)
    expect(results[1].score).toBe(0.0)
  })
})

describe('evaluateBatch', () => {
  beforeEach(() => {
    mockCreateLangfuseScore.mockClear()
    _resetInternals()
    _setSleepForTesting(noopSleep)
  })

  afterEach(() => {
    _resetInternals()
  })

  it('returns results for all traces in the batch', async () => {
    makeOpenAIClient([
      '{"score": 0.8, "reasoning": "Good for trace 1"}',
      '{"score": 0.6, "reasoning": "OK for trace 2"}',
    ])

    const results = await evaluateBatch({
      traces: [
        {
          traceId: 'trace-1',
          input: INPUT,
          output: OUTPUT,
          enabledEvaluators: ['helpfulness'],
        },
        {
          traceId: 'trace-2',
          input: 'What is 2+2?',
          output: '4',
          enabledEvaluators: ['helpfulness'],
        },
      ],
    })

    expect(results).toHaveLength(2)
    expect(results[0].traceId).toBe('trace-1')
    expect(results[1].traceId).toBe('trace-2')
  })

  it('continues processing remaining traces when one fails entirely', async () => {
    makeOpenAIClient([
      new Error('Error for trace 1 attempt 1'),
      new Error('Error for trace 1 attempt 2'),
      new Error('Error for trace 1 attempt 3'),
      '{"score": 0.7, "reasoning": "Good for trace 2"}',
    ])

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})

    const results = await evaluateBatch({
      traces: [
        {
          traceId: 'trace-fail',
          input: INPUT,
          output: OUTPUT,
          enabledEvaluators: ['helpfulness'],
        },
        {
          traceId: 'trace-success',
          input: 'What is 2+2?',
          output: '4',
          enabledEvaluators: ['helpfulness'],
        },
      ],
    })

    expect(results).toHaveLength(1)
    expect(results[0].traceId).toBe('trace-success')
    warnSpy.mockRestore()
  })

  it('runs context evaluators when context is provided', async () => {
    makeOpenAIClient([
      '{"score": 0.88, "reasoning": "Context well used"}',
    ])

    const results = await evaluateBatch({
      traces: [
        {
          traceId: TRACE_ID,
          input: INPUT,
          output: OUTPUT,
          context: CONTEXT,
          enabledEvaluators: ['context-relevance'],
        },
      ],
    })

    expect(results).toHaveLength(1)
    expect(results[0].evaluatorName).toBe('context-relevance')
    expect(results[0].score).toBe(0.88)
  })
})
