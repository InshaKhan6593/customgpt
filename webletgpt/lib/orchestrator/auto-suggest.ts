import { generateObject } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { FlowMode, WebletCategory } from "@prisma/client";
import { langfuseSpanProcessor } from "@/instrumentation";

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
      executionMode: z.enum(["PARALLEL", "HYBRID"]),
      reasoning: z.string(),
    }),
    prompt: `You are an AI workflow architect. Given a user's task and a list of available AI agents, design the optimal team composition.

USER TASK: "${task}"

AVAILABLE AGENTS:
${webletsContext}

INSTRUCTIONS:
1. Analyze the task to identify distinct sub-tasks or skill requirements.
2. Select ONLY the agents that are genuinely needed — fewer is better. Do not add agents for marginal value.
3. For each selected agent, assign a specific role (Researcher, Writer, Coder, Reviewer, Analyst, Editor, Designer, or a custom role) and explain WHY this agent was chosen over alternatives.
4. Recommend the execution mode:
   - PARALLEL: Free-form DAG. Use for ANY topology — linear pipelines (research → write → review), fan-out (one feeds many), fan-in (many feed one), or branching. This is the default. The user wires the exact connections on a canvas.
   - HYBRID: When one coordinator agent should dynamically decide which sub-agents to invoke at runtime. Best for open-ended tasks where the delegation strategy depends on intermediate results.
5. Provide concise reasoning for your team composition and mode choice.

TEAM SIZE GUIDELINES:
- Simple tasks (single skill needed): 1-2 agents
- Multi-step tasks (pipeline or parallel): 2-4 agents in PARALLEL
- Complex tasks (dynamic delegation needed): 3-5 agents in HYBRID
- Avoid teams larger than 5 unless the task genuinely requires it`,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        mode: "AUTO_SUGGEST",
        task: task.slice(0, 200),
        agentCount: String(availableWeblets.length),
      },
    },
  });

  await langfuseSpanProcessor.forceFlush();

  return result.object;
}
