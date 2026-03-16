import { z } from "zod";
import type { NodeHandoff } from "./artifact-extractor";

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
  previousHandoffs?: NodeHandoff[];
  reviewerFeedback?: string;
}): string {
  const parts: string[] = [];

  // 1. The original user request / trigger prompt
  parts.push(`## Original User Request\n${opts.userTask}`);

  // 2. Context from previous agents
  if (opts.previousOutputs && opts.previousOutputs.length > 0) {
    parts.push(`## Findings from Previous Agents\nThe following are the results and findings provided by previous agents in this workflow. Use this context to inform your work:\n`);
    for (const prev of opts.previousOutputs) {
      parts.push(`### Agent: ${prev.agentName}\n${prev.output}`);
    }
  }

  if (opts.previousHandoffs && opts.previousHandoffs.length > 0) {
    parts.push(`## Context from Previous Agents\n`);
    for (const handoff of opts.previousHandoffs) {
      const section: string[] = [];
      section.push(`### ${handoff.agentName}${handoff.role && handoff.role !== handoff.agentName ? ` (${handoff.role})` : ""}`);
      section.push(`**What was done:** ${handoff.outcomeSummary}`);
      if (handoff.reasoningSummary) {
        section.push(`**Key decisions:** ${handoff.reasoningSummary}`);
      }
      if (handoff.artifacts.length > 0) {
        section.push(`**Artifacts created:**`);
        for (const art of handoff.artifacts) {
          if (art.sandboxPath) {
            section.push(`- ${art.displayName} (${art.kind}) — sandbox path: \`${art.sandboxPath}\``);
          } else if (art.url) {
            section.push(`- ${art.displayName} (${art.kind})`);
          }
        }
      }
      if (handoff.workspaceHint) {
        section.push(`**Workspace:** ${handoff.workspaceHint}`);
      }
      parts.push(section.join("\n"));
    }
  }

  // 3. Step instructions (what this specific agent should do)
  if (opts.stepInstructions?.trim()) {
    parts.push(`## Your Specific Instructions & Role\n**CRITICAL**: You must strictly focus on the following instructions and your specific role. Do not repeat the work of previous agents, but rather build upon it as instructed below:\n\n${opts.stepInstructions.trim()}`);
  } else {
    parts.push(`## Your Role\n**CRITICAL**: You must strictly focus on your assigned role and provide the best possible output based on the user's request and any previous context provided.`);
  }

  // 4. Reviewer feedback (HITL revision)
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
