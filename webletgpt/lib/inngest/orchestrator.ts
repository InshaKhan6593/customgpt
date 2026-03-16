import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { publishProgress, type OrchestratorPublish } from "../orchestrator/realtime";
import { buildRolePrompt } from "../orchestrator/roles";
import { buildAgentMessage } from "../orchestrator/step-output-schema";
import { Sandbox } from "@e2b/code-interpreter";
import { extractArtifacts, generateHandoff, type NodeHandoff, type ArtifactRef } from "@/lib/orchestrator/artifact-extractor";
import { getActiveVersion } from "@/lib/chat/engine";
import { getLanguageModel } from "@/lib/ai/openrouter";
import { getToolsFromCapabilities } from "@/lib/tools/registry";
import { getToolsFromOpenAPI } from "@/lib/tools/openapi";
import { getMCPTools, closeMCPClients } from "@/lib/mcp/client";
import { createChildWebletTools } from "@/lib/composition/child-tool-factory";
import { generateText, streamText, stepCountIs } from "ai";
import { stopWhenAny, toolLoopDetected, noProgressDetected } from "@/lib/ai/stop-conditions";
import { langfuseSpanProcessor } from "@/instrumentation";
import { checkQuotas } from "@/lib/billing/quota-check";
import { logUsage } from "@/lib/billing/usage-logger";
import { processDeveloperOverage } from "@/lib/billing/overage";
import { autoCompactMessages } from "@/lib/utils/truncate";

const MAX_HITL_REVISIONS = 3;
const FLOW_ITERATION_LIMIT = 50; // Safety cap — prevents infinite loops on malformed DAGs

/**
 * Validate DAG before execution.
 * Returns the first error found, or null if valid.
 */
function validateDAG(nodes: any[], edges: any[]): string | null {
  const nodeIds = new Set(nodes.map((n: any) => n.id));

  // Check for self-loops
  for (const e of edges) {
    if (e.source === e.target) return `Self-loop detected on node ${e.source}`
  }

  // Check for dangling edge targets (target node doesn't exist)
  for (const e of edges) {
    if (!nodeIds.has(e.target)) return `Edge target "${e.target}" not found in nodes`
  }

  // Cycle detection via DFS coloring (0=unvisited, 1=in-stack, 2=done)
  const color = new Map<string, number>()
  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) adj.get(e.source)?.push(e.target)

  function dfs(id: string): boolean {
    if (color.get(id) === 1) return true  // back-edge = cycle
    if (color.get(id) === 2) return false
    color.set(id, 1)
    for (const next of (adj.get(id) || [])) {
      if (dfs(next)) return true
    }
    color.set(id, 2)
    return false
  }

  for (const n of nodes) {
    if (!color.has(n.id) && dfs(n.id)) return `Cycle detected in flow graph`
  }

  return null
}

/**
 * Remove a leading raw JSON artifact that some LLMs echo verbatim from tool results.
 * e.g. `["runs: 111 (Virat)"]\n\nBased on...` → `Based on...`
 * Leaves the string untouched if it doesn't start with a JSON array/object.
 */
function stripLeadingJsonArtifact(text: string): string {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return text;
  try {
    // Walk forward to find the closing bracket/brace, respecting nesting
    let depth = 0;
    let inString = false;
    let escape = false;
    let i = 0;
    for (; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "[" || ch === "{") depth++;
      if (ch === "]" || ch === "}") { depth--; if (depth === 0) { i++; break; } }
    }
    const rest = trimmed.slice(i).trimStart();
    // Only strip if there's meaningful text after the JSON blob
    if (rest.length > 20) return rest;
  } catch {}
  return text;
}

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
  handoff?: NodeHandoff;
  artifacts?: ArtifactRef[];
  developerId: string;
}

export const executeFlow = inngest.createFunction(
  { id: "execute-workflow", retries: 0 },
  { event: "flow/execute" },
  async ({ event, step, publish }) => {
    const { flowId, sessionId, userId, initialInput } = event.data;

    // Bind publish so every helper receives the same injected publisher
    const pub: OrchestratorPublish = (msg: any) => publish(msg);

    const flow = await prisma.userFlow.findUnique({ where: { id: flowId } });
    if (!flow) throw new Error("Flow not found");

    const steps = flow.steps as any[];
    if (!steps || steps.length === 0) {
      await publishProgress(pub, sessionId, "failed", { message: "No steps defined in this flow." });
      return { status: "failed", reason: "No steps defined" };
    }

    await publishProgress(pub, sessionId, "started", {
      message: `Starting flow "${flow.name}" with ${steps.length} step(s)`,
      mode: flow.mode,
    });

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

    // Batch-fetch all weblet info + active versions in a single step (one Inngest pause/resume)
    const { webletInfoMap, activeVersionMap } = await step.run("fetch-weblet-data", async () => {
      const webletIds = [...new Set(webletNodes.map(n => n.data.webletId))];
      const [weblets, versions] = await Promise.all([
        prisma.weblet.findMany({
          where: { id: { in: webletIds } },
          select: {
            id: true, name: true, capabilities: true, mcpServers: true,
            category: true, developerId: true, iconUrl: true,
            parentCompositions: {
              include: { childWeblet: { select: { id: true, name: true, slug: true, description: true } } },
            },
          },
        }),
        Promise.all(webletIds.map(id => getActiveVersion(id))),
      ]);
      const wMap: Record<string, any> = {};
      weblets.forEach(w => (wMap[w.id] = w));
      const vMap: Record<string, any> = {};
      webletIds.forEach((id, i) => (vMap[id] = versions[i]));
      return { webletInfoMap: wMap, activeVersionMap: vMap };
    });

    // ═══════════════════════════════════════════════════════════
    // ── HYBRID MODE: Master weblet orchestrates dynamically  ──
    // ═══════════════════════════════════════════════════════════
    if (flow.mode === "HYBRID" && webletNodes.length > 0) {
      // Use dedicated masterWebletId if set, otherwise fall back to first weblet node
      const masterWebletId = (flow as any).masterWebletId
        || webletNodes[0]?.data?.webletId;
      const masterNode = webletNodes.find(n => n.data.webletId === masterWebletId) || webletNodes[0];
      const subAgentNodes = webletNodes.filter(n => n.id !== masterNode.id);
      const masterInfo = webletInfoMap[masterWebletId];
      const masterVersion = activeVersionMap[masterWebletId];

      if (!masterInfo || !masterVersion) {
        await publishProgress(pub, sessionId, "failed", { message: "Master weblet configuration missing." });
        return { status: "failed", reason: "Master weblet missing config" };
      }

      const qRes = await checkQuotas(userId, masterWebletId);
      if (!qRes.allowed) {
        await publishProgress(pub, sessionId, "failed", { message: qRes.reason, quotaExceeded: true });
        return { status: "failed", reason: qRes.reason };
      }
      if (qRes.triggerReload) await processDeveloperOverage(masterInfo.developerId);

      const hybridResult = await step.run("execute-hybrid-master", async () => {
        await publishProgress(pub, sessionId, "node_started", {
          nodeId: masterNode.id, webletId: masterWebletId,
          webletName: masterInfo.name, iconUrl: masterInfo.iconUrl,
          message: `${masterInfo.name} is orchestrating...`,
        });

        // Sub-agents become tools the master can call
        const subAgentTools: Record<string, any> = {};
        for (const subNode of subAgentNodes) {
          const subInfo = webletInfoMap[subNode.data.webletId];
          if (!subInfo) continue;
          const toolName = `agent_${subInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
          subAgentTools[toolName] = {
            description: `Delegate a task to ${subInfo.name}. ${subNode.data.stepPrompt || ""}`.trim(),
            parameters: {
              type: "object",
              properties: { task: { type: "string", description: "The specific task to delegate" } },
              required: ["task"],
            },
            execute: async ({ task }: { task: string }) => {
              const { executeChildWeblet } = await import("@/lib/composition/executor");
              await publishProgress(pub, sessionId, "tool_call", {
                toolName, args: { task }, state: "running", nodeId: subNode.id,
              });
              const res = await executeChildWeblet(subNode.data.webletId, task, 1, userId);
              await publishProgress(pub, sessionId, "tool_call", {
                toolName, args: { task }, result: res.text, state: "completed", nodeId: subNode.id,
              });
              return { agent: subInfo.name, response: res.text };
            },
          };
        }

        let masterTools = getToolsFromCapabilities(masterInfo.capabilities, masterInfo.id);
        if (masterVersion.openapiSchema) {
          masterTools = {
            ...masterTools,
            ...getToolsFromOpenAPI(
              typeof masterVersion.openapiSchema === "string"
                ? masterVersion.openapiSchema
                : JSON.stringify(masterVersion.openapiSchema)
            ),
          };
        }
        masterTools = { ...masterTools, ...subAgentTools };

        const masterModel = getLanguageModel(masterVersion.model || "meta-llama/llama-3.3-70b-instruct");
        const agentList = subAgentNodes
          .map(n => webletInfoMap[n.data.webletId])
          .filter(Boolean)
          .map(w => `- ${w.name}: ${w.category || "AI assistant"}`)
          .join("\n");

        const masterSystem = `${masterVersion.prompt}

You are the master orchestrator of a multi-agent workflow. You have these sub-agents available as tools:
${agentList}

Your job:
1. Analyze the user's request
2. Break it into tasks and delegate each to the appropriate sub-agent tool
3. Synthesize all results into a final, cohesive response
4. NEVER echo raw tool output — always integrate and present information naturally`;

        let tokensIn = 0, tokensOut = 0;
        const toolCallsMap: Record<string, number> = {};
        const toolCallDetails: ToolCallDetail[] = [];

        const stream = streamText({
          model: masterModel,
          system: masterSystem,
          messages: [{ role: "user", content: initialInput }],
          tools: masterTools,
          stopWhen: stopWhenAny(stepCountIs(10), toolLoopDetected(3), noProgressDetected(5)),
          experimental_telemetry: {
            isEnabled: true,
            metadata: { webletId: masterWebletId, sessionId, flowId, mode: "HYBRID" },
          },
          async onStepFinish({ toolCalls, toolResults }: any) {
            if (toolCalls?.length > 0) {
              for (let t = 0; t < toolCalls.length; t++) {
                const tc = toolCalls[t] as any;
                toolCallsMap[tc.toolName] = (toolCallsMap[tc.toolName] || 0) + 1;
                const tr = (toolResults as any[])?.find(r => r.toolCallId === tc.toolCallId);
                toolCallDetails.push({ toolName: tc.toolName, args: tc.args || {}, result: tr?.result ?? null });
              }
            }
          },
        });

        let textBuffer = "";
        let lastFlush = Date.now();
        for await (const chunk of stream.textStream) {
          textBuffer += chunk;
          const now = Date.now();
          if (textBuffer.length >= 150 || (now - lastFlush >= 400 && textBuffer.length > 0)) {
            await publishProgress(pub, sessionId, "agent_text", {
              stepNumber: 1, agentName: masterInfo.name, text: textBuffer, nodeId: masterNode.id,
            });
            textBuffer = "";
            lastFlush = now;
          }
        }
        if (textBuffer.trim()) {
          await publishProgress(pub, sessionId, "agent_text", {
            stepNumber: 1, agentName: masterInfo.name, text: textBuffer, nodeId: masterNode.id,
          });
        }

        await langfuseSpanProcessor.forceFlush();
        const finalText = await stream.text;
        const usage = await stream.usage as any;
        tokensIn = usage?.promptTokens || 0;
        tokensOut = usage?.completionTokens || 0;

        return { text: finalText || "[No output from master]", tokensIn, tokensOut, toolCallsMap, toolCallDetails };
      });

      if (hybridResult.tokensIn > 0 || hybridResult.tokensOut > 0) {
        await logUsage({
          userId, webletId: masterWebletId, developerId: masterInfo.developerId,
          sessionId, workflowId: flowId,
          tokensIn: hybridResult.tokensIn, tokensOut: hybridResult.tokensOut,
          modelId: masterVersion.model || "meta-llama/llama-3.3-70b-instruct",
          toolCalls: Object.keys(hybridResult.toolCallsMap).length > 0 ? hybridResult.toolCallsMap : null,
          source: "ORCHESTRATION",
        });
      }

      await step.run("publish-hybrid-completed", async () => {
        await publishProgress(pub, sessionId, "completed", { finalOutput: hybridResult.text });
      });
      return { status: "success", finalOutput: hybridResult.text };
    }

    // Validate DAG before any execution
    const dagError = validateDAG(nodes, edges);
    if (dagError) {
      await publishProgress(pub, sessionId, "failed", { message: `Invalid flow graph: ${dagError}` });
      return { status: "failed", reason: dagError };
    }

    const nodeOutputs: Record<string, StepExecutionResult> = {};
    const completedNodeIds = new Set<string>();
    let finalOutput = "";

    const anyNodeHasCodeInterpreter = webletNodes.some(n => {
      const caps = webletInfoMap[n.data.webletId]?.capabilities as any;
      return caps?.codeInterpreter;
    });
    let flowSandbox: any = null;
    try {
      if (anyNodeHasCodeInterpreter && process.env.E2B_API_KEY) {
        flowSandbox = await Sandbox.create({ timeoutMs: 10 * 60 * 1000 });
        await flowSandbox.commands.run("mkdir -p /home/user/shared /home/user/nodes");
      }
    } catch (err) {
      console.warn("[Orchestrator] Failed to create shared sandbox:", err);
    }

    try {
      let currentFrontier = webletNodes.filter(n => {
        const incomingEdges = edges.filter(e => e.target === n.id);
        return incomingEdges.every(e => {
          const sourceNode = nodes.find(sn => sn.id === e.source);
          return sourceNode?.type === "prompt";
        });
      });

      let iteration = 0;

      while (currentFrontier.length > 0) {
        iteration++;

      if (iteration > FLOW_ITERATION_LIMIT) {
        await publishProgress(pub, sessionId, "failed", { message: `Flow exceeded ${FLOW_ITERATION_LIMIT} iteration limit — possible infinite loop.` });
        return { status: "failed", reason: "Iteration limit exceeded" };
      }

        const frontierResults = await Promise.all(
          currentFrontier.map(async (node) => {
          const nodeId = node.id;
          const webletId = node.data.webletId;
          const webletInfo = webletInfoMap[webletId];
          const activeVersion = activeVersionMap[webletId];

          if (!webletInfo || !activeVersion) {
            return { nodeId, status: "failed", reason: "Missing configuration" };
          }

          // ── Credit quota check ──
          const qRes = await checkQuotas(userId, webletId);
          const quotaResult = { allowed: qRes.allowed, reason: qRes.reason, triggerReload: qRes.triggerReload || false };

          if (!quotaResult.allowed) {
            await publishProgress(pub, sessionId, "failed", {
              message: `Node ${webletInfo.name} failed: ${quotaResult.reason}`,
              quotaExceeded: true,
              reason: quotaResult.reason,
            });
            return { nodeId, status: "failed", reason: quotaResult.reason };
          }

          if (quotaResult.triggerReload) {
            await processDeveloperOverage(webletInfo.developerId);
          }

          let revision = 0;
          let reviewerFeedback: string | undefined;
          let stepExecutionResult: StepExecutionResult | undefined;

          while (revision <= MAX_HITL_REVISIONS) {
            const revSuffix = revision === 0 ? "" : `-rev${revision}`;

            const nodeExec = await step.run(`execute-node-full-${nodeId}${revSuffix}`, async () => {
              await publishProgress(pub, sessionId, "node_started", {
                nodeId,
                revision,
                webletId,
                webletName: webletInfo.name,
                iconUrl: webletInfo.iconUrl,
                message: revision === 0
                  ? `Executing ${webletInfo.name}...`
                  : `Refining ${webletInfo.name} (revision ${revision})...`,
              });
              await publishProgress(pub, sessionId, revision === 0 ? "step_started" : "step_revision", {
                stepNumber: iteration,
                revision,
                webletId,
                webletName: webletInfo.name,
              });

              // Previous outputs from upstream nodes
              const MAX_PREV_OUTPUT_CHARS = 32_000;
              const incomingEdges = edges.filter(e => e.target === nodeId);
              const previousOutputs = incomingEdges
                .map(e => {
                  const sourceNode = nodes.find(sn => sn.id === e.source);
                  if (sourceNode && sourceNode.type === "weblet" && nodeOutputs[e.source]) {
                    const prev = nodeOutputs[e.source];
                    if (prev.handoff) {
                      return prev.handoff;
                    }
                    let output = prev.text;
                    if (output.length > MAX_PREV_OUTPUT_CHARS) {
                      output = output.substring(0, MAX_PREV_OUTPUT_CHARS) + "\n\n...[Output truncated]...";
                    }
                    return {
                      agentName: sourceNode.data.role || webletInfoMap[sourceNode.data.webletId]?.name || "Previous Agent",
                      role: sourceNode.data.role || webletInfoMap[sourceNode.data.webletId]?.name || "Previous Agent",
                      outcomeSummary: output,
                      reasoningSummary: "",
                      artifacts: prev.artifacts || [],
                      workspaceHint: "",
                    } as NodeHandoff;
                  }
                  return null;
                })
                .filter(Boolean) as NodeHandoff[];

              let systemPrompt = activeVersion.prompt;
              if (node.data.role) {
                systemPrompt = buildRolePrompt(
                  activeVersion.prompt,
                  node.data.role,
                  `You are an agent in a multi-agent workflow. Focus on your specific task and produce high-quality, detailed output.`
                );
              }

              if (flowSandbox) {
                try {
                  await flowSandbox.commands.run(`mkdir -p /home/user/nodes/${nodeId}`);
                  await flowSandbox.setTimeout(5 * 60 * 1000);
                } catch (err) {
                  console.warn(`[Orchestrator] Failed to setup node workspace:`, err);
                }
              }

              let tools = getToolsFromCapabilities(webletInfo.capabilities, webletInfo.id, flowSandbox ?? undefined);
              if (activeVersion.openapiSchema) {
                const customTools = getToolsFromOpenAPI(
                  typeof activeVersion.openapiSchema === "string"
                    ? activeVersion.openapiSchema
                    : JSON.stringify(activeVersion.openapiSchema)
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

              const agentMessage = buildAgentMessage({
                userTask: initialInput,
                stepInstructions: node.data.stepPrompt?.trim() || undefined,
                previousHandoffs: previousOutputs,
                reviewerFeedback,
              });

              const toolNames = Object.keys(tools);
              const hasTools = toolNames.length > 0;
              if (hasTools) {
                systemPrompt += `\n\nYou have access to the following tools: ${toolNames.join(", ")}. Use these tools if necessary to gather information. Do not call any single tool more than 3 times for the same task.\n\nIMPORTANT: After receiving tool results, synthesize the information into a clear, natural language response. NEVER echo raw tool output (JSON arrays, objects, code) directly into your answer. Always present the information in a readable, human-friendly format.`;
              }

              const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct";
              const model = getLanguageModel(modelId);
              const safeMessages = await autoCompactMessages([{ role: "user", content: agentMessage }], 33_000, model);

              let stepResult: StepExecutionResult;

              try {
                const maxSteps = hasTools ? 5 : 3;
                const abortController = new AbortController();
                const timeoutId = setTimeout(() => abortController.abort(), 900_000);

                const toolCallsMap: Record<string, number> = {};
                const toolCallDetails: ToolCallDetail[] = [];

                const stream = streamText({
                  model,
                  system: systemPrompt,
                  messages: safeMessages,
                  ...(hasTools ? { tools } : {}),
                  stopWhen: stopWhenAny(stepCountIs(maxSteps), toolLoopDetected(3), noProgressDetected(5)),
                  abortSignal: abortController.signal,
                  experimental_telemetry: {
                    isEnabled: true,
                    metadata: { webletId, sessionId, flowId, mode: "GRAPH", nodeId, revision: String(revision) },
                  },
                  async onStepFinish({ toolCalls, toolResults }: any) {
                    if (toolCalls && toolCalls.length > 0) {
                      for (let t = 0; t < toolCalls.length; t++) {
                        const tc = toolCalls[t] as any;
                        toolCallsMap[tc.toolName] = (toolCallsMap[tc.toolName] || 0) + 1;
                        const tr = (toolResults as any[])?.find(r => r.toolCallId === tc.toolCallId);
                        const result = tr?.result ?? null;
                        toolCallDetails.push({ toolName: tc.toolName, args: tc.args || tc.input || {}, result });
                        await publishProgress(pub, sessionId, "tool_call", {
                          stepNumber: iteration, toolName: tc.toolName,
                          args: tc.input || {}, result, state: "completed", nodeId,
                        });
                      }
                    }
                  },
                });

                // Stream text chunks to frontend via Inngest Realtime
                let textBuffer = "";
                let lastFlush = Date.now();
                const FLUSH_INTERVAL_MS = 400;
                const FLUSH_CHAR_THRESHOLD = 150;

                try {
                  for await (const chunk of stream.textStream) {
                    textBuffer += chunk;
                    const now = Date.now();
                    if (
                      textBuffer.length >= FLUSH_CHAR_THRESHOLD ||
                      (now - lastFlush >= FLUSH_INTERVAL_MS && textBuffer.length > 0)
                    ) {
                      await publishProgress(pub, sessionId, "agent_text", {
                        stepNumber: iteration, agentName: webletInfo.name, text: textBuffer, nodeId,
                      });
                      textBuffer = "";
                      lastFlush = now;
                    }
                  }
                  if (textBuffer.trim()) {
                    await publishProgress(pub, sessionId, "agent_text", {
                      stepNumber: iteration, agentName: webletInfo.name, text: textBuffer, nodeId,
                    });
                  }
                } finally {
                  clearTimeout(timeoutId);
                }

                await langfuseSpanProcessor.forceFlush();

                const finalText = await stream.text;
                const usage = await stream.usage as any;
                const tokensIn = usage?.promptTokens || 0;
                const tokensOut = usage?.completionTokens || 0;

                let outputText = finalText;

                // If the agent only used tools and produced no text, synthesize a response
                // from the tool results rather than returning an ugly auto-generated wrapper.
                if (!outputText && toolCallDetails.length > 0) {
                  try {
                    const synthesisModel = getLanguageModel("openai/gpt-4o-mini");
                    const synthesis = await generateText({
                      model: synthesisModel,
                      system: "You are a helpful assistant. Summarize the following tool call results into a clear, concise, and useful response for the user.",
                      messages: [{
                        role: "user",
                        content: toolCallDetails.map(tc => {
                          const res = tc.result ?? "[No result returned]";
                          return `Tool: ${tc.toolName}\nResult: ${typeof res === "string" ? res : JSON.stringify(res, null, 2)}`;
                        }).join("\n\n"),
                      }],
                    });
                    outputText = synthesis.text || "[Tool executed successfully — no summary generated]";
                  } catch {
                    // Fallback: use last tool result directly
                    const last = toolCallDetails[toolCallDetails.length - 1];
                    outputText = last.result
                      ? (typeof last.result === "string" ? last.result : JSON.stringify(last.result, null, 2))
                      : "[Tool executed successfully]";
                  }
                }

                // Strip any leading raw JSON artifact that the LLM may have echoed
                // from a tool result (e.g. `["some result"]` at start of response).
                outputText = stripLeadingJsonArtifact(outputText) || "[No output generated]";
                let outputStatus: "complete" | "needs_review" | "blocked" = "complete";
                let handoff: NodeHandoff | undefined;

                const hasDownstreamNodes = edges.some(e => e.source === nodeId);
                handoff = await generateHandoff({
                  agentName: node.data.role || webletInfo.name,
                  role: node.data.role || webletInfo.name,
                  nodeId,
                  rawOutput: outputText,
                  toolCallDetails,
                  hasDownstream: hasDownstreamNodes,
                });

                if (hasDownstreamNodes && handoff.outcomeSummary) {
                  outputText = handoff.outcomeSummary;
                  outputStatus = "complete";
                }

                stepResult = {
                  text: outputText,
                  status: outputStatus,
                  tokensIn,
                  tokensOut,
                  modelId,
                  toolCalls: toolCallsMap,
                  toolCallDetails,
                  handoff,
                  artifacts: handoff?.artifacts ?? extractArtifacts(toolCallDetails),
                  developerId: webletInfo.developerId,
                };
              } catch (llmError: any) {
                console.error(`[Orchestrator] LLM error for "${webletInfo.name}":`, llmError?.message || llmError);
                stepResult = {
                  text: `[Error]: ${llmError?.message || "Unknown error"}`,
                  status: "blocked" as const,
                  tokensIn: 0, tokensOut: 0,
                  modelId: activeVersion.model || "",
                  toolCalls: {}, toolCallDetails: [],
                  developerId: webletInfo.developerId,
                };
              } finally {
                if (mcpClients.length > 0) await closeMCPClients(mcpClients);
              }

              if (stepResult.tokensIn > 0 || stepResult.tokensOut > 0) {
                await logUsage({
                  userId, webletId, developerId: stepResult.developerId,
                  sessionId, workflowId: flowId,
                  tokensIn: stepResult.tokensIn, tokensOut: stepResult.tokensOut,
                  modelId: stepResult.modelId,
                  toolCalls: Object.keys(stepResult.toolCalls).length > 0 ? stepResult.toolCalls : null,
                  source: "ORCHESTRATION",
                });
              }

              await publishProgress(pub, sessionId, "node_completed", {
                nodeId, output: stepResult.text, status: stepResult.status,
                artifacts: stepResult.handoff?.artifacts,
              });
              await publishProgress(pub, sessionId, "step_completed", {
                stepNumber: iteration, revision, nodeId,
                webletName: webletInfo.name, output: stepResult.text,
                status: stepResult.status,
                artifacts: stepResult.handoff?.artifacts,
                toolCallDetails: stepResult.toolCallDetails.length > 0 ? stepResult.toolCallDetails : undefined,
              });

              return { status: "success", result: stepResult };
            });

            if (nodeExec.status === "failed") {
              return { nodeId, status: "failed", reason: (nodeExec as any).reason || "Execution failed" };
            }

            stepExecutionResult = nodeExec.result as StepExecutionResult;

            if (!node.data.hitlGate) break;

            await step.run(`publish-hitl-${nodeId}${revSuffix}`, async () => {
              await publishProgress(pub, sessionId, "hitl_required", { nodeId, message: "Waiting for human approval..." });
            });

            const hitlEvent = await step.waitForEvent(`wait-approval-${nodeId}${revSuffix}`, {
              event: "flow/hitl.response",
              timeout: "24h",
              match: "data.sessionId",
            });

            if (!hitlEvent || hitlEvent.data.action === "reject") {
              await step.run(`publish-hitl-reject-${nodeId}${revSuffix}`, async () => {
                await publishProgress(pub, sessionId, "failed", { message: "Flow terminated by user rejection." });
              });
              return { nodeId, status: "terminated", reason: "Rejected" };
            }

            const hasFeedback = !!hitlEvent.data.feedback?.trim();
            await step.run(`publish-hitl-approve-${nodeId}${revSuffix}`, async () => {
              await publishProgress(pub, sessionId, "hitl_completed", {
                nodeId, action: "approved",
                willRevise: hasFeedback && revision < MAX_HITL_REVISIONS,
              });
              await publishProgress(pub, sessionId, "node_completed", {
                nodeId, revision, webletId, webletName: webletInfo.name,
                message: `Completed ${webletInfo.name}.`,
              });
              await publishProgress(pub, sessionId, "step_completed", {
                stepNumber: iteration, revision, nodeId, webletId, webletName: webletInfo.name,
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
          })
        );

        const failed = frontierResults.find(r => r.status === "failed" || r.status === "terminated");
        if (failed) {
          return { status: "failed", reason: failed.reason };
        }

        for (const res of frontierResults) {
          if (res.result) {
            nodeOutputs[res.nodeId] = res.result;
            finalOutput = res.result.text;
          }
          completedNodeIds.add(res.nodeId);
        }

        currentFrontier = webletNodes.filter(n => {
          if (completedNodeIds.has(n.id)) return false;
          const incomingEdges = edges.filter(e => e.target === n.id);
          return incomingEdges.every(e => {
            const sourceNode = nodes.find(sn => sn.id === e.source);
            return sourceNode?.type === "prompt" || completedNodeIds.has(e.source);
          });
        });
      }

      await step.run("publish-completed", async () => {
        await publishProgress(pub, sessionId, "completed", { finalOutput });
      });

      return { status: "success", finalOutput };
    } finally {
      if (flowSandbox) {
        flowSandbox.kill().catch(() => {});
      }
    }
  }
);
