export const PREDEFINED_ROLES = [
  { id: "researcher", label: "Researcher", description: "Gathers information and data" },
  { id: "writer", label: "Writer", description: "Creates written content" },
  { id: "reviewer", label: "Reviewer", description: "Reviews and provides feedback" },
  { id: "editor", label: "Editor", description: "Refines and polishes content" },
  { id: "analyst", label: "Analyst", description: "Analyzes data and provides insights" },
  { id: "coder", label: "Coder", description: "Writes and debugs code" },
  { id: "designer", label: "Designer", description: "Creates visual designs" },
  { id: "custom", label: "Custom", description: "User-defined role" },
];

// Role-specific behavioral guidelines for higher quality output
const ROLE_GUIDELINES: Record<string, string> = {
  researcher: `- Prioritize accuracy and cite sources when possible
- Structure findings with clear sections and bullet points
- Distinguish between facts, estimates, and opinions
- Flag areas where information may be incomplete or uncertain`,

  writer: `- Produce clear, well-structured prose appropriate to the audience
- Use headings, subheadings, and formatting for readability
- Maintain a consistent tone throughout
- Include transitions between sections for coherent flow`,

  reviewer: `- Evaluate the input systematically for accuracy, completeness, and quality
- Provide specific, actionable feedback (not vague suggestions)
- Highlight both strengths and areas for improvement
- Organize feedback by priority: critical issues first, then minor improvements`,

  editor: `- Preserve the original voice and intent while improving clarity
- Fix grammar, spelling, and structural issues
- Tighten language — remove redundancy and filler
- Ensure formatting is consistent and professional`,

  analyst: `- Use data-driven reasoning and quantify claims where possible
- Present analysis in a structured format (tables, comparisons, matrices)
- Clearly state assumptions and methodology
- Provide actionable insights, not just observations`,

  coder: `- Write clean, production-ready code following best practices
- Include brief comments explaining non-obvious logic
- Handle edge cases and error scenarios
- If relevant, mention dependencies, setup steps, or tradeoffs`,

  designer: `- Describe visual concepts clearly with dimensions, colors, and layout
- Consider accessibility (contrast, readability, responsive behavior)
- Reference design systems or component libraries when applicable
- Prioritize user experience over visual complexity`,
};

export function buildRolePrompt(
  originalInstructions: string,
  roleLabel: string,
  taskContext: string,
) {
  const roleId = roleLabel.toLowerCase();
  const guidelines = ROLE_GUIDELINES[roleId] || "";

  return `${originalInstructions}

═══════════════════════════════════════════════════
MULTI-AGENT WORKFLOW — YOUR ROLE: ${roleLabel.toUpperCase()}
═══════════════════════════════════════════════════

You are one agent in a sequential multi-agent pipeline. Each agent has a specialized role.

YOUR ASSIGNMENT:
${taskContext}

EXECUTION RULES:
1. Stay strictly within your role. Do NOT attempt tasks assigned to other agents.
2. Produce your BEST output in a single pass — there is no back-and-forth.
3. Structure your output clearly so the next agent can build on it effectively.
4. If the input from a previous agent is unclear or incomplete, state what's missing and work with what you have.
5. Be thorough but concise — quality over quantity.
${guidelines ? `\nROLE-SPECIFIC GUIDELINES:\n${guidelines}` : ""}
═══════════════════════════════════════════════════`;
}

/**
 * Build a structured handoff message that gives the next agent
 * clear context about what happened before.
 */
export function buildHandoffMessage(opts: {
  stepNumber: number;
  totalSteps: number;
  userMessage: string;
  previousOutput?: string;
  previousRole?: string;
  reviewerFeedback?: string;
}): string {
  const parts: string[] = [];

  if (opts.stepNumber === 1 || !opts.previousOutput) {
    // First step — just the user's original request
    parts.push(opts.userMessage);
  } else {
    // Subsequent steps — structured handoff
    parts.push(`<original_request>\n${opts.userMessage}\n</original_request>`);
    parts.push(
      `<previous_agent_output${opts.previousRole ? ` role="${opts.previousRole}"` : ""}>\n${opts.previousOutput}\n</previous_agent_output>`
    );
  }

  if (opts.reviewerFeedback) {
    parts.push(
      `<reviewer_feedback>\n${opts.reviewerFeedback}\n</reviewer_feedback>\n\nIncorporate the reviewer's feedback into your work.`
    );
  }

  if (opts.totalSteps > 1 && opts.stepNumber < opts.totalSteps) {
    parts.push(
      `\n[Note: You are step ${opts.stepNumber} of ${opts.totalSteps}. Format your output so the next agent can easily build on it.]`
    );
  }

  if (opts.stepNumber === opts.totalSteps) {
    parts.push(
      `\n[Note: You are the FINAL step (${opts.stepNumber} of ${opts.totalSteps}). Produce a polished, complete result.]`
    );
  }

  return parts.join("\n\n");
}
