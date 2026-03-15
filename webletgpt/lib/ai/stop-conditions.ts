/**
 * Custom stopWhen predicates for AI SDK v6.
 *
 * Industry pattern: compose stop conditions so an agent halts when it hits a
 * step cap OR detects it is stuck in a tool loop.
 *
 * Usage:
 *   stopWhen: stopWhenAny(stepCountIs(10), toolLoopDetected(), noProgressDetected())
 */

/**
 * Compose multiple stop conditions with OR logic.
 * Accepts any condition accepted by AI SDK's `stopWhen` (StopCondition<any> or plain function).
 * Returns a plain function so TypeScript's structural typing accepts it anywhere stopWhen does.
 */
export function stopWhenAny(...conditions: Array<(state: any) => any>): (state: any) => boolean {
  return (state: any): boolean => conditions.some((c) => !!c(state))
}

/**
 * Detect a tool repetition loop: the same tool called with identical arguments
 * `threshold` times in the last `window` steps.
 *
 * Catches: web_search("X") → web_search("X") → web_search("X") → halt
 *
 * @param threshold - How many identical calls = loop (default: 3)
 * @param window    - How many recent steps to scan (default: threshold + 1)
 */
export function toolLoopDetected(threshold = 3, window?: number): (state: any) => boolean {
  const lookback = window ?? threshold + 1
  return ({ steps }: { steps: any[] }): boolean => {
    if (!steps || steps.length < threshold) return false

    const recent = steps.slice(-lookback)
    const callCounts = new Map<string, number>()

    for (const step of recent) {
      for (const tc of step.toolCalls ?? []) {
        const key = `${tc.toolName}::${JSON.stringify(tc.args ?? {})}`
        callCounts.set(key, (callCounts.get(key) ?? 0) + 1)
      }
    }

    for (const count of callCounts.values()) {
      if (count >= threshold) return true
    }
    return false
  }
}

/**
 * Detect a "no-progress" loop: the last `window` consecutive steps all ended
 * with tool calls and produced zero text output.
 *
 * Catches alternating-tool loops (A→B→A→B) that toolLoopDetected misses,
 * because each call is "different" but the agent still isn't making progress.
 *
 * @param window - Consecutive all-tool steps before halting (default: 6)
 */
export function noProgressDetected(window = 6): (state: any) => boolean {
  return ({ steps }: { steps: any[] }): boolean => {
    if (!steps || steps.length < window) return false
    return steps
      .slice(-window)
      .every((s) => (s.toolCalls?.length ?? 0) > 0 && !s.text?.trim())
  }
}
