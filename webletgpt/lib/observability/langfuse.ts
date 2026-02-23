/**
 * Langfuse Observability — OpenTelemetry initialization and score pushing
 * 
 * Stub for Segment 05. Fully implemented in Segment 16.
 * 
 * When implemented, this will:
 * 1. Initialize Langfuse OTEL tracing for all LLM calls
 * 2. Push user ratings (thumbs up/down) as Langfuse scores
 * 3. Feed RSIL evaluations for prompt version A/B testing (Segment 15/17)
 */

/**
 * Initialize Langfuse OpenTelemetry tracing.
 * Currently a no-op — will be configured in Segment 16.
 */
export function initLangfuse() {
  // TODO: Segment 16 — Initialize Langfuse OTEL with:
  // - LANGFUSE_SECRET_KEY
  // - LANGFUSE_PUBLIC_KEY  
  // - LANGFUSE_BASEURL
}

/**
 * Push a user rating score to Langfuse.
 * Currently a no-op — will be implemented in Segment 16.
 */
export async function pushLangfuseScore(
  _traceId: string,
  _name: string,
  _value: number,
  _comment?: string
) {
  // TODO: Segment 16 — POST to Langfuse /api/public/scores
}
