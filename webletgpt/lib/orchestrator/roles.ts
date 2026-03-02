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
  researcher: `- Start with broad searches, then progressively narrow your focus based on findings
- Prioritize accuracy — cite sources, URLs, and dates when possible
- Structure findings with clear sections, headings, and bullet points
- Distinguish clearly between verified facts, estimates, and opinions
- Flag areas where information may be incomplete, outdated, or uncertain
- Cross-reference multiple sources when making important claims
- Include a brief summary of key findings at the top of your output`,

  writer: `- Open with a clear thesis or purpose statement
- Produce clear, well-structured prose appropriate to the target audience
- Use headings, subheadings, and formatting for readability and scanability
- Maintain a consistent tone, voice, and perspective throughout
- Include smooth transitions between sections for coherent narrative flow
- End with a strong conclusion that reinforces the main points
- Keep paragraphs focused — one idea per paragraph`,

  reviewer: `- Evaluate the input systematically across these dimensions: accuracy, completeness, clarity, and quality
- Provide specific, actionable feedback with concrete examples — not vague suggestions
- Highlight both strengths and areas for improvement in separate sections
- Organize feedback by priority: critical issues first, then enhancements, then minor polish
- For each issue identified, suggest a specific fix or improvement
- Summarize your overall assessment at the top (e.g., "Strong draft with 2 critical issues")`,

  editor: `- Preserve the original voice, intent, and meaning while improving clarity
- Fix grammar, spelling, punctuation, and structural issues
- Tighten language — eliminate redundancy, filler words, and passive voice where possible
- Ensure formatting, capitalization, and style are consistent throughout
- Verify factual claims and flag any that seem incorrect
- Provide the edited output directly — do not just describe changes, apply them`,

  analyst: `- Use data-driven reasoning and quantify claims with specific numbers where possible
- Present analysis in structured formats: tables, comparisons, matrices, or ranked lists
- Clearly state your assumptions, data sources, and methodology upfront
- Distinguish between correlation and causation in your findings
- Provide actionable insights and recommendations, not just observations
- Include a brief executive summary of key takeaways at the top
- Acknowledge limitations and confidence levels in your analysis`,

  coder: `- Write clean, production-ready code following the language's established conventions
- Include brief comments only for non-obvious logic — avoid over-commenting
- Handle edge cases, input validation, and error scenarios appropriately
- Use meaningful variable and function names that convey intent
- If relevant, note dependencies, setup steps, performance considerations, or tradeoffs
- Provide working, testable code — not pseudocode unless specifically asked
- Follow security best practices (input sanitization, no hardcoded secrets)`,

  designer: `- Describe visual concepts with specific dimensions, colors (hex/rgb), spacing, and typography
- Consider accessibility: contrast ratios, screen reader compatibility, keyboard navigation
- Reference established design systems or component libraries when applicable
- Prioritize user experience and usability over visual complexity
- Specify responsive behavior for different screen sizes
- Include interaction states (hover, active, disabled, loading) in your descriptions
- Consider the information hierarchy — most important elements should be most prominent`,
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

You are a specialized agent in a multi-agent workflow. Your role is clearly defined — focus exclusively on it.

YOUR ASSIGNMENT:
${taskContext}

EXECUTION RULES:
1. Stay strictly within your assigned role. Do NOT attempt tasks outside your specialization.
2. Produce your BEST, most complete output in a single pass — there is no back-and-forth conversation.
3. Structure your output with clear headings, sections, and formatting so it is easy to read and build upon.
4. If the input you receive is unclear or incomplete, explicitly state what is missing or ambiguous, then work with what you have — do not silently guess.
5. Be thorough and comprehensive, but avoid unnecessary filler or repetition.
6. If you use any tools, use them purposefully — verify claims, fetch data, or execute code as needed.
7. Format your response using Markdown: use headings, bullet points, code blocks, and bold text where appropriate.
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

  if (!opts.previousOutput) {
    // First step (or no previous output) — just the user's original request
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
      `\n[PIPELINE CONTEXT: You are step ${opts.stepNumber} of ${opts.totalSteps}. Your output will be passed to the next agent. Structure it with clear sections and headings so the next agent can easily parse and build on your work. Do not include conversational pleasantries — output only substantive content.]`
    );
  }

  if (opts.stepNumber === opts.totalSteps) {
    parts.push(
      `\n[PIPELINE CONTEXT: You are the FINAL step (${opts.stepNumber} of ${opts.totalSteps}). Produce a polished, comprehensive, and well-formatted result ready for the end user. Synthesize all prior work into a coherent final deliverable. Use proper Markdown formatting with headings, lists, and code blocks where appropriate.]`
    );
  }

  return parts.join("\n\n");
}
