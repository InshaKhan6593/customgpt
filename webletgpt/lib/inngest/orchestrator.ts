import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { publishProgress } from "../orchestrator/realtime";
import { buildRolePrompt } from "../orchestrator/roles";
import { AgentOutputSchema, buildAgentMessage } from "../orchestrator/step-output-schema";
import { getActiveVersion } from "@/lib/chat/engine";
import { getLanguageModel } from "@/lib/ai/openrouter";
import { getToolsFromCapabilities } from "@/lib/tools/registry";
import { getToolsFromOpenAPI } from "@/lib/tools/openapi";
import { getMCPTools, closeMCPClients } from "@/lib/mcp/client";
import { createChildWebletTools } from "@/lib/composition/child-tool-factory";
import { createTeamMemberTools } from "../orchestrator/team-tool-factory";
import { generateText, streamText, stepCountIs, Output } from "ai";
import { langfuseSpanProcessor } from "@/instrumentation";
import { checkQuotas } from "@/lib/billing/quota-check";
import { logUsage } from "@/lib/billing/usage-logger";
import { processDeveloperOverage } from "@/lib/billing/overage";
import { autoCompactMessages } from "@/lib/utils/truncate";

const MAX_HITL_REVISIONS = 3;

interface ToolCallDetail {
  toolName: string;
  args: Record<string, any>;
  result: any;
}

interface StepExecutionResult {
  text: string;
  status: "complete" | "needs_review" | "blocked";
  tokensIn: number;
  tokensOut: number;
  modelId: string;
  toolCalls: Record<string, number>;
  toolCallDetails: ToolCallDetail[];
  developerId: string;
}

export const executeFlow = inngest.createFunction(
  { id: "execute-workflow", retries: 0 },
  { event: "flow/execute" },
  async ({ event, step }) => {
    const { flowId, sessionId, userId, initialInput } = event.data;

    const flow = await step.run("fetch-flow", async () => {
      const data = await prisma.userFlow.findUnique({ where: { id: flowId } });
      if (!data) throw new Error("Flow not found");
      return data;
    });

    const steps = flow.steps as any[];
    if (!steps || steps.length === 0) {
      await step.run("publish-no-steps", async () => {
        await publishProgress(sessionId, "failed", { message: "No steps defined in this flow." });
      });
      return { status: "failed", reason: "No steps defined" };
    }

    await step.run("publish-start", async () => {
      await publishProgress(sessionId, "started", {
        message: `Starting flow "${flow.name}" with ${steps.length} step(s)`,
        mode: flow.mode,
      });
    });

    // ═══════════════════════════════════════════════════════════
    // ── HYBRID MODE: Master agent coordinates team members ────
    // ═══════════════════════════════════════════════════════════
    if (flow.mode === "HYBRID") {
      if (!flow.masterWebletId) {
        await step.run("publish-no-master", async () => {
          await publishProgress(sessionId, "failed", { message: "Hybrid flows require a master agent. Configure one in the builder." });
        });
        return { status: "failed", reason: "No master weblet configured" };
      }

      // Fetch master weblet info
      const masterInfo = await step.run("fetch-master", async () => {
        const w = await prisma.weblet.findUnique({
          where: { id: flow.masterWebletId! },
          select: {
            id: true, name: true, capabilities: true, developerId: true,
            mcpServers: { where: { isActive: true } },
            parentCompositions: {
              include: {
                childWeblet: {
                  select: { id: true, name: true, slug: true, description: true },
                },
              },
            },
          },
        });
        if (!w) throw new Error("Master weblet not found");
        return w;
      });

      const masterVersion = await step.run("fetch-master-version", async () => {
        const v = await getActiveVersion(flow.masterWebletId!);
        if (!v) throw new Error("Master weblet has no active configuration");
        return v;
      });

      // Quota check for master
      const masterQuota = await step.run("check-master-quota", async () => {
        const result = await checkQuotas(userId, flow.masterWebletId!);
        return { allowed: result.allowed, reason: result.reason };
      });

      if (!masterQuota.allowed) {
        await step.run("publish-master-quota-fail", async () => {
          await publishProgress(sessionId, "failed", {
            message: "Master agent quota exceeded. Upgrade your plan to continue.",
            quotaExceeded: true,
            reason: masterQuota.reason,
          });
        });
        return { status: "failed", reason: masterQuota.reason };
      }

      // Batch-fetch team member info for tool descriptions
      const teamInfoMap = await step.run("fetch-team-info", async () => {
        const webletIds = [...new Set(steps.map((s: any) => s.webletId))];
        const weblets = await prisma.weblet.findMany({
          where: { id: { in: webletIds } },
          select: { id: true, name: true, slug: true, description: true, iconUrl: true, developerId: true },
        });
        const map: Record<string, any> = {};
        for (const w of weblets) {
          map[w.id] = { name: w.name, slug: w.slug, description: w.description, iconUrl: w.iconUrl, developerId: w.developerId };
        }
        return map;
      });

      // Publish hybrid team info
      await step.run("publish-hybrid-team", async () => {
        const teamMembers = steps.map((s: any) => ({
          webletId: s.webletId,
          name: teamInfoMap[s.webletId]?.name || "Unknown",
          role: s.role || null,
          iconUrl: teamInfoMap[s.webletId]?.iconUrl || null,
        }));
        await publishProgress(sessionId, "hybrid_team", {
          masterName: masterInfo.name,
          masterWebletId: flow.masterWebletId,
          teamMembers,
        });
      });

      // Publish master start so the UI renders the coordinator
      await step.run("publish-master-start", async () => {
        await publishProgress(sessionId, "step_started", {
          stepNumber: 0,
          revision: 0,
          webletId: flow.masterWebletId!,
          webletName: masterInfo.name,
          iconUrl: (masterInfo as any).iconUrl || null,
          role: "coordinator",
          inputMapping: "original",
          message: `Coordinator "${masterInfo.name}" is planning the execution...`,
        });
      });

      // Execute master agent with team members as tools
      const hybridResult = await step.run("execute-master", async () => {
        // Create team member tools
        const teamTools = createTeamMemberTools(steps, teamInfoMap, {
          userId,
          sessionId,
          flowId,
          coordinatorName: masterInfo.name,
        });

        // Master's own tools
        let masterTools = getToolsFromCapabilities(masterInfo.capabilities, masterInfo.id);
        if (masterVersion.openapiSchema) {
          const customTools = getToolsFromOpenAPI(
            typeof masterVersion.openapiSchema === "string"
              ? masterVersion.openapiSchema
              : JSON.stringify(masterVersion.openapiSchema)
          );
          masterTools = { ...masterTools, ...customTools };
        }

        let mcpClients: Array<{ close: () => Promise<void> }> = [];
        if (masterInfo.mcpServers && masterInfo.mcpServers.length > 0) {
          try {
            const mcpResult = await getMCPTools(masterInfo.mcpServers, userId);
            masterTools = { ...masterTools, ...mcpResult.tools };
            mcpClients = mcpResult.clients;
          } catch (err) {
            console.warn(`[Orchestrator] MCP tools failed for master ${masterInfo.name}:`, err);
          }
        }

        if (masterInfo.parentCompositions && masterInfo.parentCompositions.length > 0) {
          const childTools = createChildWebletTools(masterInfo.parentCompositions);
          masterTools = { ...masterTools, ...childTools };
        }

        // Merge: team tools + master's own tools
        const allTools = { ...teamTools, ...masterTools };

        // Build coordinator system prompt
        const teamDescription = steps.map((s: any, i: number) => {
          const info = teamInfoMap[s.webletId];
          const slug = info?.slug || info?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "_") || `agent_${i}`;
          return `- team_${slug}_${i}: "${info?.name || "Agent"}"${s.role ? ` (Role: ${s.role})` : ""} — ${info?.description || "A specialized AI assistant"}`;
        }).join("\n");

        const coordinatorPrompt = `${masterVersion.prompt}

═══════════════════════════════════════════════════
COORDINATOR ROLE — MULTI-AGENT ORCHESTRATION
═══════════════════════════════════════════════════

You are the lead coordinator of a multi-agent team. You receive the user's request, decompose it into clear sub-tasks, delegate each sub-task to the most appropriate team member, and synthesize all outputs into a single polished final response.

AVAILABLE TEAM MEMBERS:
${teamDescription}

PLANNING PHASE — Before calling any team member:
1. Analyze the user's request to identify distinct sub-tasks
2. Determine which team member(s) are best suited for each sub-task
3. Consider dependencies — some tasks may need to run before others

DELEGATION RULES:
- For each delegation, provide a clear objective, expected output format, and task boundaries
- Do NOT give vague instructions like "help with this" — be specific about what you need
- You may call multiple team members for different parts of the task
- You may call the same team member more than once if the task requires it
- Keep delegations focused — one clear sub-task per call

EFFORT SCALING:
- Simple questions → 1-2 team members, direct delegation
- Multi-part tasks → assign each part to the most relevant specialist
- Complex research/analysis → use multiple specialists, then synthesize

ERROR HANDLING:
- If a team member returns an error or quota limit, work with what you have from other members
- If a critical team member fails, try rephrasing the task or using an alternative member
- Never silently drop information — acknowledge gaps in your final response

FINAL SYNTHESIS:
- After receiving all outputs, combine them into a coherent, well-structured response
- Resolve any contradictions between team member outputs
- Format the final response with clear sections, headings, and structure
- Credit specific insights to the relevant team member when appropriate
- Deliver a complete, polished result — the user should not need to ask follow-up questions
═══════════════════════════════════════════════════`;

        const modelId = masterVersion.model || "meta-llama/llama-3.3-70b-instruct";
        const model = getLanguageModel(modelId);

        try {
          const result = await generateText({
            model,
            system: coordinatorPrompt,
            messages: [{ role: "user", content: initialInput }],
            tools: allTools,
            stopWhen: stepCountIs(5),
            experimental_telemetry: {
              isEnabled: true,
              metadata: {
                webletId: flow.masterWebletId!,
                sessionId,
                flowId,
                mode: "HYBRID",
                role: "coordinator",
              },
            },
            async onStepFinish(stepResult) {
              const { toolCalls, toolResults, text } = stepResult;

              // Check if this step had any team tool calls
              // If so, skip publishing — team tool execute already published text + handoff events
              const hasTeamToolCall = toolCalls?.some((tc: any) => tc.toolName.startsWith("team_"));

              // Publish coordinator's intermediate text only when it has tool calls
              // (meaning it's reasoning between tool steps, not the final response)
              const hasAnyToolCall = toolCalls && toolCalls.length > 0;
              if (!hasTeamToolCall && hasAnyToolCall && text && text.trim()) {
                await publishProgress(sessionId, "agent_text", {
                  stepNumber: 0,
                  agentName: masterInfo.name,
                  text: text.trim(),
                });
              }

              // Publish non-team tool calls (team handoffs are published from team-tool-factory)
              if (toolCalls && toolCalls.length > 0) {
                for (let t = 0; t < toolCalls.length; t++) {
                  const tc = toolCalls[t] as any;
                  if (!tc.toolName.startsWith("team_")) {
                    await publishProgress(sessionId, "tool_call", {
                      stepNumber: 0,
                      toolName: tc.toolName,
                      args: tc.input || {},
                      result: (toolResults as any)?.[t]?.output ?? null,
                      state: "completed",
                      isCoordinator: true,
                    });
                  }
                }
              }
            },
          });

          await langfuseSpanProcessor.forceFlush();

          const usage = result.usage as any;
          return {
            text: result.text || "[No output generated]",
            tokensIn: usage?.promptTokens || 0,
            tokensOut: usage?.completionTokens || 0,
            modelId,
            developerId: masterInfo.developerId,
          };
        } catch (llmError: any) {
          console.error(`[Orchestrator] HYBRID master error:`, llmError?.message);
          return {
            text: `[Error from coordinator]: ${llmError?.message || "Unknown error"}`,
            tokensIn: 0,
            tokensOut: 0,
            modelId,
            developerId: masterInfo.developerId,
          };
        } finally {
          if (mcpClients.length > 0) {
            await closeMCPClients(mcpClients);
          }
        }
      });

      // Publish master complete
      await step.run("publish-master-complete", async () => {
        await publishProgress(sessionId, "step_completed", {
          stepNumber: 0,
          revision: 0,
          webletId: flow.masterWebletId!,
          webletName: masterInfo.name,
          role: "coordinator",
          output: hybridResult.text,
        });
      });

      // Log master usage
      if (hybridResult.tokensIn > 0 || hybridResult.tokensOut > 0) {
        await step.run("log-master-usage", async () => {
          await logUsage({
            userId,
            webletId: flow.masterWebletId!,
            developerId: hybridResult.developerId,
            sessionId,
            workflowId: flowId,
            tokensIn: hybridResult.tokensIn,
            tokensOut: hybridResult.tokensOut,
            modelId: hybridResult.modelId,
            toolCalls: null,
            source: "ORCHESTRATION",
          });
        });
      }

      await step.run("publish-hybrid-completed", async () => {
        await publishProgress(sessionId, "completed", { finalOutput: hybridResult.text, mode: "HYBRID" });
      });

      return { status: "success", finalOutput: hybridResult.text };
    }

    // ═══════════════════════════════════════════════════════════
    // ── GRAPH MODE (DAG): Nodes execute based on dependencies ─
    // ═══════════════════════════════════════════════════════════
    const canvasState = flow.canvasState as any || null;
    let nodes: any[] = [];
    let edges: any[] = [];

    if (canvasState && canvasState.nodes && canvasState.nodes.length > 0) {
      nodes = canvasState.nodes;
      edges = canvasState.edges;
    } else {
      // Fallback for older linear flows without canvasState saved yet
      nodes = [{ id: "prompt-1", type: "prompt" }];
      steps.forEach((s, i) => {
        const id = `weblet-${s.webletId}-${i}`;
        nodes.push({
          id,
          type: "weblet",
          data: { webletId: s.webletId, role: s.role, stepPrompt: s.stepPrompt, hitlGate: s.hitlGate }
        });
        edges.push({ source: i === 0 ? "prompt-1" : `weblet-${steps[i - 1].webletId}-${i - 1}`, target: id });
      });
    }

    const webletNodes = nodes.filter(n => n.type === "weblet");
    const nodeOutputs: Record<string, StepExecutionResult> = {};
    const completedNodeIds = new Set<string>();
    let finalOutput = "";

    // Batch-fetch all weblet info for UI display + credit checks
    const webletInfoMap = await step.run("fetch-all-weblets", async () => {
      const webletIds = [...new Set(webletNodes.map(n => n.data.webletId))];
      const weblets = await prisma.weblet.findMany({
        where: { id: { in: webletIds } },
        select: { id: true, name: true, capabilities: true, mcpServers: true, category: true, developerId: true, iconUrl: true, parentCompositions: { include: { childWeblet: { select: { id: true, name: true, slug: true, description: true } } } } },
      });
      const map: Record<string, any> = {};
      weblets.forEach(w => map[w.id] = w);
      return map;
    });

    // Active Version Map
    const activeVersionMap = await step.run("fetch-active-versions", async () => {
      const webletIds = [...new Set(webletNodes.map(n => n.data.webletId))];
      const versions = await Promise.all(webletIds.map(id => getActiveVersion(id)));
      const map: Record<string, any> = {};
      webletIds.forEach((id, i) => map[id] = versions[i]);
      return map;
    });

    let currentFrontier = webletNodes.filter(n => {
      const incomingEdges = edges.filter(e => e.target === n.id);
      return incomingEdges.every(e => {
        const sourceNode = nodes.find(sn => sn.id === e.source);
        return sourceNode?.type === "prompt" || !sourceNode;
      });
    });

    let iteration = 0;

    while (currentFrontier.length > 0) {
      iteration++;

      // Execute frontier in parallel
      const frontierResults = await Promise.all(currentFrontier.map(async (node) => {
        const nodeId = node.id;
        const webletId = node.data.webletId;
        const webletInfo = webletInfoMap[webletId];
        const activeVersion = activeVersionMap[webletId];

        if (!webletInfo || !activeVersion) {
          return { nodeId, status: "failed", reason: "Missing configuration" };
        }

        // ── Credit quota check ──
        const quotaResult = await step.run(`check-quota-${nodeId}`, async () => {
          const result = await checkQuotas(userId, webletId);
          return { allowed: result.allowed, reason: result.reason, triggerReload: result.triggerReload || false };
        });

        if (!quotaResult.allowed) {
          await step.run(`publish-quota-fail-${nodeId}`, async () => {
            await publishProgress(sessionId, "failed", {
              message: `Node ${webletInfo.name} failed: ${quotaResult.reason}`,
              quotaExceeded: true,
              reason: quotaResult.reason,
            });
          });
          return { nodeId, status: "failed", reason: quotaResult.reason };
        }

        if (quotaResult.triggerReload) {
          await step.run(`auto-reload-${nodeId}`, async () => {
            await processDeveloperOverage(webletInfo.developerId);
          });
        }

        let revision = 0;
        let reviewerFeedback: string | undefined;
        let stepExecutionResult: StepExecutionResult | undefined;

        while (revision <= MAX_HITL_REVISIONS) {
          const revSuffix = revision === 0 ? "" : `-rev${revision}`;

          await step.run(`publish-step-${nodeId}${revSuffix}`, async () => {
            // Let the UI know this node started (for animations/glow)
            await publishProgress(sessionId, "node_started", {
              nodeId,
              revision,
              webletId,
              webletName: webletInfo.name,
              iconUrl: webletInfo.iconUrl,
              message: revision === 0 ? `Executing ${webletInfo.name}...` : `Refining ${webletInfo.name} (revision ${revision})...`,
            });
            // Keeping backwards compat event for generic log UI
            await publishProgress(sessionId, revision === 0 ? "step_started" : "step_revision", {
              stepNumber: iteration,
              revision,
              webletId,
              webletName: webletInfo.name,
            });
          });

          // Fetch previous outputs explicitly feeding into this node
          // Truncate each to ~8K tokens (~32K chars) to prevent context overflow and slow generation
          const MAX_PREV_OUTPUT_CHARS = 32_000;
          const incomingEdges = edges.filter(e => e.target === nodeId);
          const previousOutputs = incomingEdges.map(e => {
            const sourceNode = nodes.find(sn => sn.id === e.source);
            if (sourceNode && sourceNode.type === "weblet" && nodeOutputs[e.source]) {
              let output = nodeOutputs[e.source].text;
              if (output.length > MAX_PREV_OUTPUT_CHARS) {
                output = output.substring(0, MAX_PREV_OUTPUT_CHARS) + "\n\n...[Output truncated for context efficiency]...";
              }
              return {
                agentName: sourceNode.data.role || webletInfoMap[sourceNode.data.webletId]?.name || "Previous Agent",
                output,
              };
            }
            return null;
          }).filter(Boolean) as { agentName: string; output: string }[];

          const stepResult = await step.run(`execute-step-${nodeId}${revSuffix}`, async (): Promise<StepExecutionResult> => {
            // Build system prompt — agent's own instructions
            let systemPrompt = activeVersion.prompt;
            if (node.data.role) {
              systemPrompt = buildRolePrompt(
                activeVersion.prompt,
                node.data.role,
                `You are an agent in a multi-agent workflow. Focus on your specific task and produce high-quality, detailed output.`
              );
            }

            // Assemble tools
            let tools = getToolsFromCapabilities(webletInfo.capabilities, webletInfo.id);
            if (activeVersion.openapiSchema) {
              const customTools = getToolsFromOpenAPI(
                typeof activeVersion.openapiSchema === "string" ? activeVersion.openapiSchema : JSON.stringify(activeVersion.openapiSchema)
              );
              tools = { ...tools, ...customTools };
            }

            let mcpClients: Array<{ close: () => Promise<void> }> = [];
            if (webletInfo.mcpServers && webletInfo.mcpServers.length > 0) {
              try {
                const mcpResult = await getMCPTools(webletInfo.mcpServers, userId);
                tools = { ...tools, ...mcpResult.tools };
                mcpClients = mcpResult.clients;
              } catch (err) {
                console.warn(`[Orchestrator] MCP tools failed for ${webletInfo.name}:`, err);
              }
            }
            if (webletInfo.parentCompositions && webletInfo.parentCompositions.length > 0) {
              const childTools = createChildWebletTools(webletInfo.parentCompositions);
              tools = { ...tools, ...childTools };
            }

            // Build the user message — clean format, no pipeline jargon
            const agentMessage = buildAgentMessage({
              userTask: initialInput,
              stepInstructions: node.data.stepPrompt?.trim() || undefined,
              previousOutputs,
              reviewerFeedback,
            });

            // Tell the agent about its tools
            const toolNames = Object.keys(tools);
            const hasTools = toolNames.length > 0;
            if (hasTools) {
              systemPrompt += `\n\nYou have access to the following tools: ${toolNames.join(", ")}. Use these tools if necessary to gather information. You do not need to use tools if you already know the answer or have sufficient context.`;
            }

            const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct";
            const model = getLanguageModel(modelId);

            const safeMessages = await autoCompactMessages([{ role: "user", content: agentMessage }], 33_000, model);

            console.log(`[Orchestrator] Agent "${webletInfo.name}": tools=[${toolNames.join(", ")}], stepInstructions=${!!node.data.stepPrompt?.trim()}, previousOutputs=${previousOutputs.length}`);

            try {
              const maxSteps = hasTools ? 5 : 3;

              console.log(`[Orchestrator] Calling streamText for node "${webletInfo.name}" (model: ${modelId}, tools: ${Object.keys(tools).length}, messages: ${safeMessages.length})`);
              const abortController = new AbortController();
              const timeoutId = setTimeout(() => abortController.abort(), 300_000); // 5 min timeout

              const toolCallsMap: Record<string, number> = {};
              const toolCallDetails: ToolCallDetail[] = [];

              const stream = streamText({
                model,
                system: systemPrompt,
                messages: safeMessages,
                ...(hasTools ? { tools } : {}),
                stopWhen: stepCountIs(maxSteps),
                abortSignal: abortController.signal,
                experimental_telemetry: {
                  isEnabled: true,
                  metadata: { webletId, sessionId, flowId, mode: "GRAPH", nodeId, revision: String(revision) },
                },
                async onStepFinish({ toolCalls, toolResults }: any) {
                  // Publish tool calls (text is streamed via textStream below)
                  if (toolCalls && toolCalls.length > 0) {
                    for (let t = 0; t < toolCalls.length; t++) {
                      const tc = toolCalls[t] as any;
                      toolCallsMap[tc.toolName] = (toolCallsMap[tc.toolName] || 0) + 1;
                      const result = (toolResults as any)?.[t]?.output ?? null;
                      toolCallDetails.push({ toolName: tc.toolName, args: tc.input || {}, result });
                      await publishProgress(sessionId, "tool_call", {
                        stepNumber: iteration, toolName: tc.toolName,
                        args: tc.input || {}, result, state: "completed", nodeId,
                      });
                    }
                  }
                },
              });

              // Stream text chunks to frontend in real-time via Ably
              let textBuffer = "";
              let lastFlush = Date.now();
              const FLUSH_INTERVAL_MS = 400;
              const FLUSH_CHAR_THRESHOLD = 150;

              try {
                for await (const chunk of stream.textStream) {
                  textBuffer += chunk;
                  const now = Date.now();
                  if (textBuffer.length >= FLUSH_CHAR_THRESHOLD || (now - lastFlush >= FLUSH_INTERVAL_MS && textBuffer.length > 0)) {
                    await publishProgress(sessionId, "agent_text", {
                      stepNumber: iteration, agentName: webletInfo.name, text: textBuffer, nodeId,
                    });
                    textBuffer = "";
                    lastFlush = now;
                  }
                }
                // Flush remaining text
                if (textBuffer.trim()) {
                  await publishProgress(sessionId, "agent_text", {
                    stepNumber: iteration, agentName: webletInfo.name, text: textBuffer, nodeId,
                  });
                }
              } finally {
                clearTimeout(timeoutId);
              }

              await langfuseSpanProcessor.forceFlush();

              // Resolve final result properties (available after stream completes)
              const finalText = await stream.text;
              const usage = await stream.usage as any;
              const tokensIn = usage?.promptTokens || 0;
              const tokensOut = usage?.completionTokens || 0;

              let outputText = finalText || "[No output generated]";
              let outputStatus: "complete" | "needs_review" | "blocked" = "complete";

              // If this node feeds into downstream agents, extract clean structured content
              // so the next agent gets a focused work product (not reasoning/preamble)
              const hasDownstreamNodes = edges.some(e => e.source === nodeId);
              if (hasDownstreamNodes && outputText.length > 200) {
                try {
                  const extractionModel = getLanguageModel("openai/gpt-4o-mini");
                  const extraction = await generateText({
                    model: extractionModel,
                    output: Output.object({ schema: AgentOutputSchema }),
                    system: "Extract the agent's actual work product from the raw output below. Strip any preamble, reasoning, or meta-commentary. Return only the substantive content the next agent needs.",
                    messages: [{ role: "user", content: outputText }],
                  });
                  const structured = (extraction as any).output;
                  if (structured?.content) {
                    outputText = structured.content;
                    outputStatus = structured.status || "complete";
                    console.log(`[Orchestrator] Extracted structured output for "${webletInfo.name}": ${outputText.length} chars (was ${finalText.length})`);
                  }
                } catch (extractErr: any) {
                  // Extraction failed — use raw text, which is fine
                  console.warn(`[Orchestrator] Structured extraction skipped for "${webletInfo.name}":`, extractErr?.message?.substring(0, 100));
                }
              }
              console.log(`[Orchestrator] Stream completed for "${webletInfo.name}": length=${outputText.length}, status=${outputStatus}, tokens=${tokensIn}+${tokensOut}`);

              return { text: outputText, status: outputStatus, tokensIn, tokensOut, modelId, toolCalls: toolCallsMap, toolCallDetails, developerId: webletInfo.developerId };

            } catch (llmError: any) {
              console.error(`[Orchestrator] LLM error for "${webletInfo.name}":`, llmError?.message || llmError);
              return { text: `[Error]: ${llmError?.message || "Unknown error"}`, status: "blocked" as const, tokensIn: 0, tokensOut: 0, modelId: activeVersion.model || "", toolCalls: {}, toolCallDetails: [], developerId: webletInfo.developerId };
            } finally {
              if (mcpClients.length > 0) await closeMCPClients(mcpClients);
            }
          });

          stepExecutionResult = stepResult;

          // Deduct credits and log
          if (stepResult.tokensIn > 0 || stepResult.tokensOut > 0) {
            await step.run(`log-usage-${nodeId}${revSuffix}`, async () => {
              await logUsage({ userId, webletId, developerId: stepResult.developerId, sessionId, workflowId: flowId, tokensIn: stepResult.tokensIn, tokensOut: stepResult.tokensOut, modelId: stepResult.modelId, toolCalls: Object.keys(stepResult.toolCalls).length > 0 ? stepResult.toolCalls : null, source: "ORCHESTRATION" });
            });
          }

          await step.run(`publish-step-done-${nodeId}${revSuffix}`, async () => {
            // The UI will use this to turn off node glow animations
            await publishProgress(sessionId, "node_completed", { nodeId, output: stepResult.text, status: stepResult.status });

            // Step completion for history
            await publishProgress(sessionId, "step_completed", {
              stepNumber: iteration, revision, nodeId, webletName: webletInfo.name, output: stepResult.text,
              status: stepResult.status,
              toolCallDetails: stepResult.toolCallDetails.length > 0 ? stepResult.toolCallDetails : undefined,
            });
          });

          if (!node.data.hitlGate) break;

          await step.run(`publish-hitl-${nodeId}${revSuffix}`, async () => {
            await publishProgress(sessionId, "hitl_required", { nodeId, message: "Waiting for human approval..." });
          });

          const hitlEvent = await step.waitForEvent(`wait-approval-${nodeId}${revSuffix}`, { event: "flow/hitl.response", timeout: "24h", match: "data.sessionId" });
          if (!hitlEvent || hitlEvent.data.action === "reject") {
            await step.run(`publish-hitl-reject-${nodeId}`, async () => {
              await publishProgress(sessionId, "failed", { message: "Flow terminated by user rejection." });
            });
            return { nodeId, status: "terminated", reason: "Rejected" };
          }

          const hasFeedback = !!hitlEvent.data.feedback?.trim();
          await step.run(`publish-hitl-resolved-${nodeId}${revSuffix}`, async () => {
            await publishProgress(sessionId, "hitl_completed", { nodeId, action: "approved", willRevise: hasFeedback && revision < MAX_HITL_REVISIONS });
          });

          // Node has completed successfully
          await step.run(`publish-completed-${nodeId}${revSuffix}`, async () => {
            await publishProgress(sessionId, "node_completed", {
              nodeId,
              revision,
              webletId,
              webletName: webletInfo.name,
              message: `Completed ${webletInfo.name}.`,
            });
            // Legacy generic event
            await publishProgress(sessionId, "step_completed", {
              stepNumber: iteration,
              revision,
              nodeId,
              webletId,
              webletName: webletInfo.name,
            });
          });

          if (hasFeedback && revision < MAX_HITL_REVISIONS) {
            reviewerFeedback = hitlEvent.data.feedback;
            revision++;
            continue;
          }
          break;
        }

        return { nodeId, status: "success", result: stepExecutionResult };
      }));

      // Check results
      const failed = frontierResults.find(r => r.status === "failed" || r.status === "terminated");
      if (failed) {
        return { status: "failed", reason: failed.reason };
      }

      // Record successful completions
      for (const res of frontierResults) {
        if (res.result) {
          nodeOutputs[res.nodeId] = res.result;
          finalOutput = res.result.text; // Output of the last node to execute
        }
        completedNodeIds.add(res.nodeId);
      }

      // Calculate next frontier
      currentFrontier = webletNodes.filter(n => {
        if (completedNodeIds.has(n.id)) return false; // Already done
        const incomingEdges = edges.filter(e => e.target === n.id);
        const depsMet = incomingEdges.every(e => {
          const sourceNode = nodes.find(sn => sn.id === e.source);
          return sourceNode?.type === "prompt" || completedNodeIds.has(e.source) || !sourceNode;
        });
        return depsMet;
      });
    }

    await step.run("publish-completed", async () => {
      await publishProgress(sessionId, "completed", { finalOutput });
    });

    return { status: "success", finalOutput };
  }
);
