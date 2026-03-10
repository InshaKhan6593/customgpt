import { z } from "zod";

/**
 * Simplified agent output schema — industry-aligned (CrewAI / LangGraph / AutoGen).
 *
 * Each agent produces:
 * - `content`: Complete work product in markdown
 * - `status`: Whether the agent finished or needs help
 *
 * Design principles:
 * - Keep it lean — agent focuses 100% on producing quality content
 * - No meta-fields (summary, keyPoints, etc.) that waste model tokens
 * - Status field lets orchestrator know if the agent completed or is blocked
 */
export const AgentOutputSchema = z.object({
  /** The agent's complete work product. Use markdown formatting. Be thorough and detailed. */
  content: z.string().describe(
    "Your complete output for this task. This is your main work product. " +
    "Use markdown formatting (headings, lists, code blocks) for structure. " +
    "Be thorough and detailed — this is what the next agent or end user will receive."
  ),

  /** Whether you fully completed the task or need additional input. */
  status: z.enum(["complete", "needs_review", "blocked"]).describe(
    "Almost always 'complete'. Use 'complete' whenever you have produced an output for the task. " +
    "Only use 'blocked' if you literally cannot do the task due to missing tools or information. " +
    "Do NOT use 'needs_review' — just set 'complete'."
  ),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// Keep backward compat aliases
export const StepOutputSchema = AgentOutputSchema;
export type StepOutput = AgentOutput;

/**
 * Build the user message passed to an agent in a workflow.
 * Clean format — no XML tags, no pipeline jargon.
 */
export function buildAgentMessage(opts: {
  userTask: string;
  stepInstructions?: string;
  previousOutputs?: { agentName: string; output: string }[];
  reviewerFeedback?: string;
}): string {
  const parts: string[] = [];

  // Step instructions from the workflow creator (what this agent should do)
  if (opts.stepInstructions?.trim()) {
    parts.push(`## Your Task\n${opts.stepInstructions.trim()}`);
  }

  // The original user request / trigger prompt
  parts.push(`## User's Request\n${opts.userTask}`);

  // Context from previous agents
  if (opts.previousOutputs && opts.previousOutputs.length > 0) {
    parts.push(`## Context from Previous Agents\nUse the following outputs from previous agents to inform your work:\n`);
    for (const prev of opts.previousOutputs) {
      parts.push(`### ${prev.agentName}\n${prev.output}`);
    }
  }

  // Reviewer feedback (HITL revision)
  if (opts.reviewerFeedback?.trim()) {
    parts.push(
      `## Reviewer Feedback\nA human reviewer has provided feedback on your previous output. Address every point:\n\n${opts.reviewerFeedback.trim()}`
    );
  }

  return parts.join("\n\n");
}

// Keep backward compat alias
export const buildStructuredHandoff = (opts: {
  userMessage: string;
  previousOutputs?: { role: string; result: string }[];
  reviewerFeedback?: string;
  isFinalStep?: boolean;
}): string => {
  return buildAgentMessage({
    userTask: opts.userMessage,
    previousOutputs: opts.previousOutputs?.map(p => ({
      agentName: p.role,
      output: p.result,
    })),
    reviewerFeedback: opts.reviewerFeedback,
  });
};
