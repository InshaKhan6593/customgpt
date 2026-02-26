import { generateObject } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { FlowMode, WebletCategory } from "@prisma/client";

// A simplified interface representing what we pass to the prompt
export interface WebletSummary {
  id: string;
  name: string;
  description: string | null;
  category: WebletCategory;
  capabilities: any;
}

export async function suggestTeam(task: string, availableWeblets: WebletSummary[]) {
  // Use a fast/smart model for reasoning
  const model = openrouter("anthropic/claude-3.5-sonnet");

  const webletsContext = availableWeblets
    .map((w) => `- ${w.id}: ${w.name} (${w.category}) — ${w.description || "No description"}. Capabilities: ${JSON.stringify(w.capabilities)}`)
    .join("\n");

  const result = await generateObject({
    model,
    schema: z.object({
      suggestedTeam: z.array(
        z.object({
          webletId: z.string(),
          role: z.string(),
          reason: z.string(),
        })
      ),
      executionMode: z.nativeEnum(FlowMode),
      reasoning: z.string(),
    }),
    prompt: `Given this user task: "${task}"
And these available AI agents/weblets:

${webletsContext}

Suggest the optimal team of weblets from the available list to accomplish this task.
For each selected weblet, assign it a role (e.g., Writer, Researcher, Coder, Reviewer) and explain why it was chosen.
Recommend the best execution mode (SEQUENTIAL or HYBRID).
Provide an overall reasoning for your choices.`,
  });

  return result.object;
}
