'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle } from 'lucide-react'
import {
  EvaluatorConfig,
  OPTIONAL_EVALUATOR_MAX_WEIGHT,
  normalizeOptionalWeights,
} from '@/lib/rsil/governance'
import { CONTEXT_EVALUATORS } from '@/lib/rsil/evaluator-prompts'

interface EvaluatorConfigProps {
  webletId: string
  value: EvaluatorConfig
  onChange: (config: EvaluatorConfig) => void
  disabled?: boolean
}

type BaseEvaluatorKey = keyof EvaluatorConfig['baseEvaluators']
type OptionalEvaluatorKey = keyof EvaluatorConfig['optionalEvaluators']

const BASE_EVALUATOR_LABELS: Record<BaseEvaluatorKey, string> = {
  helpfulness: 'Helpfulness',
  correctness: 'Correctness',
  hallucination: 'Hallucination',
}

const OPTIONAL_EVALUATOR_LABELS: Record<OptionalEvaluatorKey, string> = {
  toxicity: 'Toxicity',
  conciseness: 'Conciseness',
  'context-relevance': 'Context Relevance',
  'context-correctness': 'Context Correctness',
  faithfulness: 'Faithfulness',
  'answer-relevance': 'Answer Relevance',
}

export function EvaluatorConfigSection({
  webletId,
  value,
  onChange,
  disabled = false,
}: EvaluatorConfigProps) {
  const [hasContext, setHasContext] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/rsil/trace-compatibility?webletId=${webletId}`)
      .then((res) => res.json())
      .then((data) => {
        setHasContext(data.hasContext ?? false)
        setLoading(false)
      })
      .catch(() => {
        setHasContext(false)
        setLoading(false)
      })
  }, [webletId])

  function handleOptionalToggle(key: OptionalEvaluatorKey, enabled: boolean) {
    const updated: EvaluatorConfig = {
      ...value,
      optionalEvaluators: {
        ...value.optionalEvaluators,
        [key]: {
          ...value.optionalEvaluators[key],
          enabled,
          weight: enabled ? Math.max(value.optionalEvaluators[key].weight, 5) : 0,
        },
      },
    }
    onChange(normalizeOptionalWeights(updated))
  }

  function handleOptionalWeightChange(key: OptionalEvaluatorKey, weight: number) {
    const updated: EvaluatorConfig = {
      ...value,
      optionalEvaluators: {
        ...value.optionalEvaluators,
        [key]: {
          ...value.optionalEvaluators[key],
          weight,
        },
      },
    }
    onChange(normalizeOptionalWeights(updated))
  }

  const isContextEvaluator = (key: string): boolean =>
    (CONTEXT_EVALUATORS as string[]).includes(key)

  const isEvaluatorGrayedOut = (key: OptionalEvaluatorKey): boolean =>
    isContextEvaluator(key) && !hasContext

  return (
    <Card className="bg-card/50 p-4 space-y-4">
      <h3 className="font-semibold text-lg border-b pb-2">Evaluator Configuration</h3>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Base Evaluators (Always Active)
        </p>
        <div className="space-y-2 pt-1">
          {(Object.keys(value.baseEvaluators) as BaseEvaluatorKey[]).map((key) => {
            const entry = value.baseEvaluators[key]
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium truncate">
                  {BASE_EVALUATOR_LABELS[key]}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                    {entry.weight}%
                  </span>
                  <Switch checked={true} disabled aria-label={`${key} always enabled`} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t" />

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Optional Evaluators
        </p>
        <div className="space-y-3 pt-1">
          {(Object.keys(value.optionalEvaluators) as OptionalEvaluatorKey[]).map((key) => {
            const entry = value.optionalEvaluators[key]
            const grayedOut = isEvaluatorGrayedOut(key)
            const isContext = isContextEvaluator(key)

            return (
              <div
                key={key}
                className={`space-y-1.5 transition-opacity ${grayedOut ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {OPTIONAL_EVALUATOR_LABELS[key]}
                    </span>
                    {isContext && !hasContext && !loading && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center text-amber-500 cursor-help shrink-0">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          This evaluator requires trace context (RAG/retrieval), which is not
                          available for this weblet.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">
                      {entry.enabled ? `${entry.weight.toFixed(1)}%` : '0%'}
                    </span>
                    <Switch
                      checked={entry.enabled}
                      disabled={disabled || grayedOut}
                      onCheckedChange={(checked: boolean) => handleOptionalToggle(key, checked)}
                      aria-label={`Toggle ${key} evaluator`}
                    />
                  </div>
                </div>

                {entry.enabled && !grayedOut && (
                  <div className="pl-1 pr-[52px]">
                    <Slider
                      min={0}
                      max={OPTIONAL_EVALUATOR_MAX_WEIGHT}
                      step={1}
                      value={[Math.round(entry.weight)]}
                      onValueChange={([v]: number[]) => handleOptionalWeightChange(key, v)}
                      disabled={disabled}
                      aria-label={`${key} weight`}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
