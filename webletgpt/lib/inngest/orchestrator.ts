import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { publishProgress } from "../orchestrator/realtime";
import { buildRolePrompt, buildHandoffMessage } from "../orchestrator/roles";
import { getActiveVersion } from "@/lib/chat/engine";
import { getLanguageModel } from "@/lib/ai/openrouter";
import { getToolsFromCapabilities } from "@/lib/tools/registry";
import { getToolsFromOpenAPI } from "@/lib/tools/openapi";
import { getMCPTools, closeMCPClients } from "@/lib/mcp/client";
import { createChildWebletTools } from "@/lib/composition/child-tool-factory";
import { createTeamMemberTools } from "../orchestrator/team-tool-factory";
import { generateText, stepCountIs } from "ai";
import { langfuseSpanProcessor } from "@/instrumentation";
import { checkQuotas } from "@/lib/billing/quota-check";
import { logUsage } from "@/lib/billing/usage-logger";
import { processDeveloperOverage } from "@/lib/billing/overage";

const MAX_HITL_REVISIONS = 3;

interface ToolCallDetail {
  toolName: string;
  args: Record<string, any>;
  result: any;
}

interface StepExecutionResult {
  text: string;
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

      // Execute master agent with team members as tools
      const hybridResult = await step.run("execute-master", async () => {
        // Create team member tools
        const teamTools = createTeamMemberTools(steps, teamInfoMap, {
          userId,
          sessionId,
          flowId,
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
            stopWhen: stepCountIs(10),
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
            onStepFinish({ toolCalls, toolResults }) {
              if (toolCalls && toolCalls.length > 0) {
                for (let t = 0; t < toolCalls.length; t++) {
                  const tc = toolCalls[t] as any;
                  // Only publish non-team tool calls (team tools publish their own events)
                  if (!tc.toolName.startsWith("team_")) {
                    publishProgress(sessionId, "tool_call", {
                      stepNumber: 0,
                      toolName: tc.toolName,
                      args: tc.args || {},
                      result: (toolResults as any)?.[t]?.result ?? null,
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
    // ── SEQUENTIAL MODE: Steps execute one after another ──────
    // ═══════════════════════════════════════════════════════════
    let currentOutput = "";
    let previousRole: string | null = null;
    let stepResults: any[] = [];

    for (let i = 0; i < steps.length; i++) {
      const currentStep = steps[i];

      // Pre-fetch weblet info for UI display + credit checks
      const webletInfo = await step.run(`fetch-weblet-info-${i}`, async () => {
        const w = await prisma.weblet.findUnique({
          where: { id: currentStep.webletId },
          select: { name: true, iconUrl: true, developerId: true },
        });
        return {
          name: w?.name || "Unknown Agent",
          iconUrl: w?.iconUrl || null,
          developerId: w?.developerId || "",
        };
      });

      // ── Credit quota check before each step ──
      const quotaResult = await step.run(`check-quota-${i}`, async () => {
        const result = await checkQuotas(userId, currentStep.webletId);
        return {
          allowed: result.allowed,
          reason: result.reason,
          triggerReload: result.triggerReload || false,
        };
      });

      if (!quotaResult.allowed) {
        // Graceful degradation: skip this step or terminate
        const reason = quotaResult.reason === "developer_credits_exhausted"
          ? `"${webletInfo.name}" is temporarily unavailable (creator quota exceeded).`
          : `Your credit quota has been exceeded. Upgrade your plan to continue.`;

        await step.run(`publish-quota-fail-${i}`, async () => {
          await publishProgress(sessionId, "failed", {
            message: `Step ${i + 1} failed: ${reason}`,
            quotaExceeded: true,
            reason: quotaResult.reason,
          });
        });
        return { status: "failed", reason: quotaResult.reason };
      }

      // Trigger auto-reload if developer is at limit
      if (quotaResult.triggerReload) {
        await step.run(`auto-reload-${i}`, async () => {
          const reloaded = await processDeveloperOverage(webletInfo.developerId);
          if (!reloaded) {
            console.warn(`[Orchestrator] Auto-reload failed for developer ${webletInfo.developerId}`);
          }
        });
      }

      // Revision loop: execute step, optionally re-execute if HITL feedback given
      let revision = 0;
      let reviewerFeedback: string | undefined;

      while (revision <= MAX_HITL_REVISIONS) {
        const revSuffix = revision === 0 ? "" : `-rev${revision}`;

        await step.run(`publish-step-${i}${revSuffix}`, async () => {
          await publishProgress(sessionId, revision === 0 ? "step_started" : "step_revision", {
            stepNumber: i + 1,
            revision,
            webletId: currentStep.webletId,
            webletName: webletInfo.name,
            iconUrl: webletInfo.iconUrl,
            role: currentStep.role || null,
            inputMapping: currentStep.inputMapping || (i === 0 ? "original" : "previous"),
            message: revision === 0
              ? `Executing step ${i + 1} of ${steps.length}...`
              : `Refining step ${i + 1} with reviewer feedback (revision ${revision})...`,
          });
        });

        // Execute the AI call
        const stepResult = await step.run(`execute-step-${i}${revSuffix}`, async (): Promise<StepExecutionResult> => {
          const weblet = await prisma.weblet.findUnique({
            where: { id: currentStep.webletId },
            select: {
              id: true, name: true, capabilities: true, category: true, developerId: true,
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

          if (!weblet) {
            return { text: `[Error: Weblet ${currentStep.webletId} not found]`, tokensIn: 0, tokensOut: 0, modelId: "", toolCalls: {}, toolCallDetails: [], developerId: "" };
          }

          const activeVersion = await getActiveVersion(currentStep.webletId);
          if (!activeVersion) {
            return { text: `[Error: No active prompt version for weblet "${weblet.name}"]`, tokensIn: 0, tokensOut: 0, modelId: "", toolCalls: {}, toolCallDetails: [], developerId: weblet.developerId };
          }

          // Build system prompt with role
          let systemPrompt = activeVersion.prompt;
          if (currentStep.role) {
            systemPrompt = buildRolePrompt(
              activeVersion.prompt,
              currentStep.role,
              `You are step ${i + 1} of ${steps.length} in a sequential pipeline.
${i === 0
                ? "You receive the user's original request directly. Your output will be passed to the next agent."
                : i === steps.length - 1
                  ? `You receive the output from the previous agent (${previousRole || "step " + i}). You are the FINAL agent — deliver a polished, complete result ready for the end user.`
                  : `You receive the output from the previous agent (${previousRole || "step " + i}). Your output will be passed to the next agent in the pipeline.`
              }${revision > 0
                ? "\n\nIMPORTANT: A human reviewer has provided feedback on your previous output. Carefully read the feedback, address every point raised, and produce a significantly improved version. Do not simply repeat your previous output."
                : ""
              }`
            );
          }

          // Inject per-step custom instructions if provided
          if (currentStep.stepPrompt?.trim()) {
            systemPrompt += `\n\nADDITIONAL INSTRUCTIONS FROM WORKFLOW CREATOR:\n${currentStep.stepPrompt.trim()}`;
          }

          // Assemble tools
          let tools = getToolsFromCapabilities(weblet.capabilities, weblet.id);
          if (activeVersion.openapiSchema) {
            const customTools = getToolsFromOpenAPI(
              typeof activeVersion.openapiSchema === "string"
                ? activeVersion.openapiSchema
                : JSON.stringify(activeVersion.openapiSchema)
            );
            tools = { ...tools, ...customTools };
          }

          // MCP Server Tools — connect to external MCP servers
          let mcpClients: Array<{ close: () => Promise<void> }> = [];
          if (weblet.mcpServers && weblet.mcpServers.length > 0) {
            try {
              const mcpResult = await getMCPTools(weblet.mcpServers, userId);
              tools = { ...tools, ...mcpResult.tools };
              mcpClients = mcpResult.clients;
            } catch (err) {
              console.warn(`[Orchestrator] MCP tools failed for ${weblet.name}:`, err);
            }
          }

          // Composition Tools — expose child weblets as callable tools
          if (weblet.parentCompositions && weblet.parentCompositions.length > 0) {
            const childTools = createChildWebletTools(weblet.parentCompositions);
            tools = { ...tools, ...childTools };
          }

          // Build structured handoff message
          const userMessage = buildHandoffMessage({
            stepNumber: i + 1,
            totalSteps: steps.length,
            userMessage: initialInput,
            previousOutput:
              currentStep.inputMapping === "original"
                ? (revision > 0 ? currentOutput : undefined)
                : currentOutput || undefined,
            previousRole: revision > 0 ? (currentStep.role || "you (previous draft)") : (previousRole || undefined),
            reviewerFeedback,
          });

          const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct";
          const model = getLanguageModel(modelId);
          const hasTools = Object.keys(tools).length > 0;

          try {
            const result = await generateText({
              model,
              system: systemPrompt,
              messages: [{ role: "user", content: userMessage }],
              ...(hasTools ? { tools, stopWhen: stepCountIs(5) } : {}),
              experimental_telemetry: {
                isEnabled: true,
                metadata: {
                  webletId: currentStep.webletId,
                  sessionId,
                  flowId,
                  mode: "SEQUENTIAL",
                  stepNumber: String(i + 1),
                  revision: String(revision),
                  role: currentStep.role || "none",
                },
              },
              onStepFinish({ toolCalls, toolResults }) {
                // Publish each tool call in real-time as the AI executes multi-step
                if (toolCalls && toolCalls.length > 0) {
                  for (let t = 0; t < toolCalls.length; t++) {
                    const tc = toolCalls[t] as any;
                    publishProgress(sessionId, "tool_call", {
                      stepNumber: i + 1,
                      revision,
                      toolName: tc.toolName,
                      args: tc.args || {},
                      result: (toolResults as any)?.[t]?.result ?? null,
                      state: "completed",
                    });
                  }
                }
              },
            });

            await langfuseSpanProcessor.forceFlush();

            // Extract token usage + tool calls for billing
            const usage = result.usage as any;
            const tokensIn = usage?.promptTokens || 0;
            const tokensOut = usage?.completionTokens || 0;
            const toolCallsMap: Record<string, number> = {};
            const toolCallDetails: ToolCallDetail[] = [];

            // Collect tool calls from ALL steps (multi-step execution)
            if (result.steps && result.steps.length > 0) {
              for (const s of result.steps) {
                if (s.toolCalls && s.toolCalls.length > 0) {
                  for (let t = 0; t < s.toolCalls.length; t++) {
                    const tc = s.toolCalls[t] as any;
                    toolCallsMap[tc.toolName] = (toolCallsMap[tc.toolName] || 0) + 1;
                    toolCallDetails.push({
                      toolName: tc.toolName,
                      args: tc.args || {},
                      result: (s.toolResults as any)?.[t]?.result ?? null,
                    });
                  }
                }
              }
            } else if (result.toolCalls && result.toolCalls.length > 0) {
              // Fallback for single-step results
              for (const tc of result.toolCalls) {
                const tcAny = tc as any;
                toolCallsMap[tcAny.toolName] = (toolCallsMap[tcAny.toolName] || 0) + 1;
                toolCallDetails.push({
                  toolName: tcAny.toolName,
                  args: tcAny.args || {},
                  result: null,
                });
              }
            }

            return {
              text: result.text || "[No output generated]",
              tokensIn,
              tokensOut,
              modelId,
              toolCalls: toolCallsMap,
              toolCallDetails,
              developerId: weblet.developerId,
            };
          } catch (llmError: any) {
            console.error(`[Orchestrator] LLM error at step ${i + 1} rev ${revision}:`, {
              model: modelId,
              weblet: weblet.name,
              error: llmError?.message,
              cause: llmError?.cause,
              statusCode: llmError?.statusCode,
              responseBody: llmError?.responseBody,
            });
            return {
              text: `[Error from ${weblet.name}]: ${llmError?.message || "Unknown LLM error"}`,
              tokensIn: 0,
              tokensOut: 0,
              modelId,
              toolCalls: {},
              toolCallDetails: [],
              developerId: weblet.developerId,
            };
          } finally {
            // Close MCP clients to prevent connection leaks
            if (mcpClients.length > 0) {
              await closeMCPClients(mcpClients);
            }
          }
        });

        currentOutput = stepResult.text;

        // ── Log usage + deduct credits after step completes ──
        if (stepResult.tokensIn > 0 || stepResult.tokensOut > 0) {
          await step.run(`log-usage-${i}${revSuffix}`, async () => {
            await logUsage({
              userId,
              webletId: currentStep.webletId,
              developerId: stepResult.developerId || webletInfo.developerId,
              sessionId,
              workflowId: flowId,
              tokensIn: stepResult.tokensIn,
              tokensOut: stepResult.tokensOut,
              modelId: stepResult.modelId,
              toolCalls: Object.keys(stepResult.toolCalls).length > 0 ? stepResult.toolCalls : null,
              source: "ORCHESTRATION",
            });
          });
        }

        await step.run(`publish-step-done-${i}${revSuffix}`, async () => {
          await publishProgress(sessionId, "step_completed", {
            stepNumber: i + 1,
            revision,
            webletName: webletInfo.name,
            role: currentStep.role || null,
            output: stepResult.text,
            toolCallDetails: stepResult.toolCallDetails.length > 0 ? stepResult.toolCallDetails : undefined,
          });
        });

        // HITL gate check
        if (!currentStep.hitlGate) break;

        await step.run(`publish-hitl-${i}${revSuffix}`, async () => {
          await publishProgress(sessionId, "hitl_required", {
            stepNumber: i + 1,
            revision,
            message: revision === 0
              ? "Waiting for human approval..."
              : `Revision ${revision} complete — waiting for approval...`,
          });
        });

        const hitlEvent = await step.waitForEvent(`wait-approval-${i}${revSuffix}`, {
          event: "flow/hitl.response",
          timeout: "24h",
          match: "data.sessionId",
        });

        if (!hitlEvent || hitlEvent.data.action === "reject") {
          await step.run(`publish-hitl-reject-resolved-${i}${revSuffix}`, async () => {
            await publishProgress(sessionId, "hitl_completed", {
              stepNumber: i + 1,
              action: "rejected",
              feedback: hitlEvent?.data?.feedback || "",
            });
          });
          await step.run(`publish-hitl-rejected-${i}${revSuffix}`, async () => {
            await publishProgress(sessionId, "failed", {
              message: "Flow terminated by user rejection at step " + (i + 1),
            });
          });
          return { status: "terminated", reason: "Rejected by human in the loop" };
        }

        const hasFeedback = !!hitlEvent.data.feedback?.trim();

        await step.run(`publish-hitl-resolved-${i}${revSuffix}`, async () => {
          await publishProgress(sessionId, "hitl_completed", {
            stepNumber: i + 1,
            action: "approved",
            feedback: hitlEvent.data.feedback || "",
            willRevise: hasFeedback && revision < MAX_HITL_REVISIONS,
          });
        });

        if (hasFeedback && revision < MAX_HITL_REVISIONS) {
          reviewerFeedback = hitlEvent.data.feedback;
          revision++;
          continue;
        }

        break;
      }

      stepResults.push({ step: i + 1, webletId: currentStep.webletId, output: currentOutput });
      previousRole = currentStep.role || null;
    }

    await step.run("publish-completed", async () => {
      await publishProgress(sessionId, "completed", { finalOutput: currentOutput, allResults: stepResults });
    });

    return { status: "success", finalOutput: currentOutput };
  }
);
