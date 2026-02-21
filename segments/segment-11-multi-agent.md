# Segment 12: Multi-Agent Orchestration

**Estimated effort:** 4 weeks
**Depends on:** Segment 05 (Chat Engine & Tools)
**Produces:** Multi-agent chat interface where weblets collaborate sequentially/concurrently/hybrid with human-in-the-loop, role assignment, auto-team suggestion, and real-time progress

---

## Goal

Build the most advanced module — a multi-agent orchestration system where multiple weblets collaborate on complex tasks. Users can select teams of weblets, assign roles, choose execution modes, and intervene at any point.

This is the client's key differentiator: "the chat user interface enables weblet-to-weblet conversations, human loop in conversations, decisions/roles among weblets, weblets working sequentially, simultaneously or concurrently."

---

## What Already Exists (from Segments 01-05)

```
Chat Engine:
  chatWithWeblet(webletId, messages) → returns AI response with tool calls
  Tool registry resolves capabilities per weblet
  Streaming via SSE (Vercel AI SDK)
Database:
  Weblet — all configs, ChatSession, ChatMessage, AnalyticsEvent
```

**Key reuse:** The existing chat engine's `chatWithWeblet()` function is called per-agent. The orchestrator coordinates multiple calls.

---

## Critical Technical Decisions

### 1. Real-Time Communication

**Problem:** Vercel's serverless architecture does NOT support persistent WebSocket connections. Socket.io is incompatible.

**Solution:** Use **Ably** (managed real-time service) for multi-agent progress updates.

| Use Case | Technology | Why |
|----------|-----------|-----|
| Single chat streaming | SSE via Vercel AI SDK | Already works, native Vercel support |
| Multi-agent progress | Ably (pub/sub) | Managed WebSocket, works on serverless, generous free tier |
| HITL approval | Ably + Server Actions | Publish pause event → client shows UI → client publishes approval → server continues |

**Ably free tier:** 6M messages/month, 200 concurrent connections. More than enough for early stage.

### 2. Bypassing Serverless Timeouts

**Problem:** Vercel has strict execution limits (e.g. 60s for Pro). A multi-agent orchestration workflow involving several LLM calls will almost certainly exceed this and get killed mid-execution.

**Solution:** Use **Inngest** for background job execution. The orchestrator engine runs as an Inngest step function, which can pause and resume indefinitely without hitting Vercel's timeouts.

---

## Files to Create

```
app/(chat)/orchestrate/
├── page.tsx                          ← Multi-agent chat page
└── [sessionId]/page.tsx              ← Resume orchestration session

app/api/orchestrate/
├── route.ts                          ← Start orchestration (POST)
├── approve/route.ts                  ← Human-in-the-loop approval (POST)
└── cancel/route.ts                   ← Cancel running orchestration (POST)

lib/orchestrator/
├── engine.ts                         ← Core orchestration logic (sequential, concurrent, hybrid)
├── planner.ts                        ← Breaks user task into steps + assigns weblets
├── sequential.ts                     ← Execute weblets one after another
├── concurrent.ts                     ← Execute weblets in parallel (Promise.all)
├── hybrid.ts                         ← Mix: some steps sequential, some concurrent
├── roles.ts                          ← Role assignment system for weblets
├── hitl.ts                           ← Human-in-the-loop pause/resume/override
├── auto-suggest.ts                   ← LLM-based team recommendation
├── simulator.ts                      ← Dry-run simulation before execution
└── realtime.ts                       ← Ably pub/sub wrapper for progress events

components/orchestrate/
├── orchestrate-container.tsx         ← Full layout for multi-agent interface
├── task-input.tsx                    ← Task description input + "Optimize & Execute" button
├── agent-selector.tsx                ← Pick weblets for the team (search + select)
├── auto-suggest-panel.tsx            ← Shows AI-recommended team with reasoning
├── role-assignment.tsx               ← Assign roles to selected weblets (dropdown per weblet)
├── execution-mode-toggle.tsx         ← Sequential / Concurrent / Hybrid radio buttons
├── hitl-settings.tsx                 ← Human-in-the-loop configuration
├── agent-timeline.tsx                ← Visual timeline showing step-by-step execution
├── agent-card.tsx                    ← Shows individual agent's status, output, tools used
├── handoff-display.tsx               ← Shows data flowing between agents
├── hitl-approval-dialog.tsx          ← Modal: Review output + Approve / Edit / Reject
├── simulation-preview.tsx            ← Shows planned execution steps before running
└── control-panel.tsx                 ← Execution mode, simulator toggle, HITL settings
```

---

## Implementation Details

### 1. Orchestrator Engine

The core loop that coordinates multiple weblets:

```typescript
// lib/orchestrator/engine.ts
export async function orchestrate(config: OrchestrationConfig) {
  const { task, agents, mode, hitlConfig, sessionId } = config;

  // 1. Plan the execution
  const plan = await createExecutionPlan(task, agents);
  await publishProgress(sessionId, "plan_created", { plan });

  // 2. Execute based on mode
  let results: AgentResult[];
  switch (mode) {
    case "sequential":
      results = await executeSequential(plan.steps, sessionId, hitlConfig);
      break;
    case "concurrent":
      results = await executeConcurrent(plan.steps, sessionId, hitlConfig);
      break;
    case "hybrid":
      results = await executeHybrid(plan.steps, sessionId, hitlConfig);
      break;
  }

  // 3. Compile final output
  const finalOutput = await compileFinalOutput(results, task);
  await publishProgress(sessionId, "completed", { finalOutput });

  // 4. Log analytics
  await logOrchestrationAnalytics(sessionId, config, results);

  return finalOutput;
}
```

### 2. Execution Plan (LLM-Powered)

Use an LLM to break the task into steps and decide which weblets handle each step:

```typescript
// lib/orchestrator/planner.ts
export async function createExecutionPlan(task: string, agents: WebletSummary[]) {
  const result = await generateObject({
    model: openrouter("anthropic/claude-3.5-sonnet"),
    schema: z.object({
      steps: z.array(z.object({
        stepNumber: z.number(),
        description: z.string(),
        agentId: z.string(),
        agentRole: z.string(), // "researcher", "writer", "reviewer", etc.
        dependsOn: z.array(z.number()), // Step numbers this depends on
        canRunConcurrently: z.boolean(),
        requiresHumanApproval: z.boolean(),
      })),
    }),
    prompt: `Given this task: "${task}"
And these available AI agents:
${agents.map(a => `- ${a.name} (${a.id}): ${a.description}`).join("\n")}

Create an execution plan. Break the task into steps, assign each step to the best agent,
identify dependencies between steps, and mark which steps can run concurrently.
Mark steps that produce high-risk or user-facing output as requiring human approval.`,
  });

  return result.object;
}
```

### 3. Sequential Execution

```typescript
// lib/orchestrator/sequential.ts
export async function executeSequential(steps: Step[], sessionId: string, hitl: HITLConfig) {
  const results: AgentResult[] = [];
  let context = ""; // Accumulated context from previous agents

  for (const step of steps) {
    await publishProgress(sessionId, "agent_started", { step });

    // Build message with context from previous agents
    const messages = [
      { role: "user", content: `${step.description}\n\nContext from previous steps:\n${context}` },
    ];

    // Execute the agent
    const result = await chatWithWeblet(step.agentId, messages);
    results.push({ step, output: result });

    await publishProgress(sessionId, "agent_completed", { step, output: result });

    // Human-in-the-loop check
    if (step.requiresHumanApproval || hitl.mode === "always") {
      await publishProgress(sessionId, "hitl_required", { step, output: result });
      const approval = await waitForHumanApproval(sessionId, step.stepNumber);

      if (approval.action === "reject") {
        throw new OrchestrationCanceled("Rejected by human reviewer");
      }
      if (approval.action === "edit") {
        // Re-run step with human's feedback
        const revisedMessages = [...messages, { role: "user", content: approval.feedback }];
        const revised = await chatWithWeblet(step.agentId, revisedMessages);
        results[results.length - 1] = { step, output: revised };
      }
    }

    // Add to context for next agent
    context += `\n\n--- ${step.agentRole} (${step.description}) ---\n${result}`;
  }

  return results;
}
```

### 4. Concurrent Execution

```typescript
// lib/orchestrator/concurrent.ts
export async function executeConcurrent(steps: Step[], sessionId: string, hitl: HITLConfig) {
  // Group steps by dependency level
  const levels = groupByDependencyLevel(steps);

  const results: AgentResult[] = [];

  for (const level of levels) {
    // Execute all steps in this level concurrently
    const levelResults = await Promise.all(
      level.map(async (step) => {
        await publishProgress(sessionId, "agent_started", { step });
        const result = await chatWithWeblet(step.agentId, [
          { role: "user", content: step.description },
        ]);
        await publishProgress(sessionId, "agent_completed", { step, output: result });
        return { step, output: result };
      })
    );

    results.push(...levelResults);

    // HITL check after each level
    if (hitl.mode === "after_each_level") {
      await publishProgress(sessionId, "hitl_required", { level: levelResults });
      await waitForHumanApproval(sessionId, level[0].stepNumber);
    }
  }

  return results;
}
```

### 5. Role System (Was Missing)

The client requires "decisions/roles among weblets." Implement a role assignment system:

```typescript
// lib/orchestrator/roles.ts
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

// Role is injected into the agent's system prompt at runtime:
function buildRolePrompt(originalInstructions: string, role: string, taskContext: string) {
  return `${originalInstructions}

YOUR ROLE IN THIS COLLABORATION: ${role}
You are working as part of a team. Focus specifically on your role.
Other agents will handle their own responsibilities.

TASK CONTEXT: ${taskContext}`;
}
```

### 6. Auto-Team Suggestion (Was Missing)

The client says the system should "automatically suggest the best team of weblets":

```typescript
// lib/orchestrator/auto-suggest.ts
export async function suggestTeam(task: string, availableWeblets: WebletSummary[]) {
  const result = await generateObject({
    model: openrouter("anthropic/claude-3.5-sonnet"),
    schema: z.object({
      suggestedTeam: z.array(z.object({
        webletId: z.string(),
        role: z.string(),
        reason: z.string(), // Why this weblet was chosen
      })),
      executionMode: z.enum(["sequential", "concurrent", "hybrid"]),
      reasoning: z.string(), // Overall explanation
    }),
    prompt: `Given this task: "${task}"
And these available weblets:
${availableWeblets.map(w => `- ${w.id}: ${w.name} — ${w.description} (Capabilities: ${JSON.stringify(w.capabilities)})`).join("\n")}

Suggest the optimal team of weblets to accomplish this task.
For each weblet, explain its role and why it was chosen.
Recommend the best execution mode (sequential, concurrent, or hybrid).`,
  });

  return result.object;
}
```

### 7. Simulation Preview (Was Missing)

The client mentions "availability of simulator." Before executing, show a dry-run preview:

```typescript
// lib/orchestrator/simulator.ts
export async function simulateExecution(plan: ExecutionPlan) {
  // Don't actually call LLMs — just show the planned steps
  return {
    steps: plan.steps.map(step => ({
      ...step,
      estimatedTime: estimateStepTime(step), // Based on agent's avg response time
      estimatedTokens: estimateTokens(step),
      estimatedCost: estimateCost(step),
    })),
    totalEstimatedTime: sum(steps.map(s => s.estimatedTime)),
    totalEstimatedCost: sum(steps.map(s => s.estimatedCost)),
    hitlPausePoints: plan.steps.filter(s => s.requiresHumanApproval).length,
  };
}
```

Show this to the user before they click "Execute" so they know what will happen.

### 8. Real-Time Progress via Ably

```typescript
// lib/orchestrator/realtime.ts
import Ably from "ably";

const ably = new Ably.Rest(process.env.ABLY_API_KEY!);

export async function publishProgress(sessionId: string, event: string, data: any) {
  const channel = ably.channels.get(`orchestration:${sessionId}`);
  await channel.publish(event, data);
}

// Client-side hook
export function useOrchestrationProgress(sessionId: string) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);

  useEffect(() => {
    const ably = new Ably.Realtime(process.env.NEXT_PUBLIC_ABLY_KEY!);
    const channel = ably.channels.get(`orchestration:${sessionId}`);

    channel.subscribe((msg) => {
      setEvents(prev => [...prev, { type: msg.name, data: msg.data, timestamp: new Date() }]);
    });

    return () => { channel.unsubscribe(); ably.close(); };
  }, [sessionId]);

  return events;
}
```

### 9. Human-in-the-Loop Controls

Three modes (from client requirements):

| Mode | Behavior |
|------|----------|
| **Auto Trigger** | System pauses when confidence is low or output is high-risk (determined by planner) |
| **Manual Review** | Human reviews every agent's output before the next step |
| **Override Required** | Specific steps marked as requiring explicit human approval |

The approval dialog shows:
- Agent name and role
- Full output from the agent
- Three buttons: **Approve** / **Edit & Resubmit** / **Reject**
- Optional feedback text field

---

## Acceptance Criteria

- [ ] User can select 2+ weblets for a multi-agent task
- [ ] Auto-team suggestion: system recommends weblets with reasoning
- [ ] Role assignment: user can assign roles to each weblet from predefined list
- [ ] Execution mode toggle: Sequential / Concurrent / Hybrid
- [ ] Simulation preview shows planned steps, estimated time, and cost before execution
- [ ] Sequential execution: Agent A finishes → output passed to Agent B → etc.
- [ ] Concurrent execution: Independent agents run simultaneously
- [ ] Hybrid execution: Mix of sequential and concurrent based on dependencies
- [ ] Real-time progress via Ably: shows which agent is active, tool calls, completion
- [ ] Agent timeline visualizes step-by-step execution
- [ ] Each agent's output displayed individually with expandable details
- [ ] Human-in-the-loop: Auto Trigger mode pauses at high-risk steps
- [ ] Human-in-the-loop: Manual Review mode pauses after every agent
- [ ] HITL approval dialog: Approve / Edit & Resubmit / Reject buttons
- [ ] Rejected step cancels orchestration with clear message
- [ ] Edit & Resubmit re-runs the agent with human's feedback
- [ ] Data handoff between agents is visible (shows what was passed)
- [ ] Cancel button stops orchestration mid-execution
- [ ] Analytics logged: total agents, execution time, mode, HITL count

---

## Dependencies to Install

```bash
npm install ably                  # Real-time pub/sub
npm install inngest               # Background workflow orchestration
```

---

## Environment Variables to Add

```env
ABLY_API_KEY=xxxxx               # Server-side
NEXT_PUBLIC_ABLY_KEY=xxxxx       # Client-side (publishable)
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM planner creates bad execution plans | Allow users to edit the plan before execution. Show simulation preview. |
| Concurrent agents produce conflicting outputs | Final compilation step (LLM) resolves conflicts and merges outputs |
| Long orchestrations timeout on Vercel | The orchestration engine runs inside an Inngest background workflow, safely bypassing Vercel timeout limits. |
| Ably free tier limits | 6M messages/month is generous. Monitor usage. Upgrade if needed ($29/month). |
| Auto-suggest quality | Include weblet descriptions and capabilities in the prompt. Allow user override. |
