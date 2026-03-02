import { tool } from "ai";
import { z } from "zod";
import { generateText, stepCountIs } from "ai";
import { prisma } from "@/lib/prisma";
import { getActiveVersion } from "@/lib/chat/engine";
import { getLanguageModel } from "@/lib/ai/openrouter";
import { getToolsFromCapabilities } from "@/lib/tools/registry";
import { getToolsFromOpenAPI } from "@/lib/tools/openapi";
import { getMCPTools, closeMCPClients } from "@/lib/mcp/client";
import { createChildWebletTools } from "@/lib/composition/child-tool-factory";
import { buildRolePrompt } from "./roles";
import { publishProgress } from "./realtime";
import { checkQuotas } from "@/lib/billing/quota-check";
import { logUsage } from "@/lib/billing/usage-logger";
import { langfuseSpanProcessor } from "@/instrumentation";

interface FlowStep {
  webletId: string;
  order: number;
  role?: string;
  stepPrompt?: string;
  inputMapping: string;
  hitlGate: boolean;
}

interface WebletInfo {
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  developerId: string;
}

interface TeamToolContext {
  userId: string;
  sessionId: string;
  flowId: string;
}

/**
 * Create callable tools for each team member in a HYBRID flow.
 *
 * Each team member weblet becomes a tool the master agent can invoke.
 * The tool handles the full lifecycle: quota check, prompt building,
 * tool aggregation, LLM call, usage logging, and realtime events.
 */
export function createTeamMemberTools(
  steps: FlowStep[],
  webletInfoMap: Record<string, WebletInfo>,
  context: TeamToolContext
): Record<string, any> {
  const tools: Record<string, any> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const info = webletInfoMap[step.webletId];
    if (!info) continue;

    const slug = info.slug || info.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const toolName = `team_${slug}_${i}`;
    const roleLabel = step.role ? ` (${step.role})` : "";

    tools[toolName] = tool({
      description: `Delegate a sub-task to "${info.name}"${roleLabel}. Specialization: ${info.description || "A specialized AI assistant"}. Send a clear, specific task description — include the objective, expected output format, and any relevant context from other team members' results.${step.stepPrompt ? ` Creator notes: ${step.stepPrompt}` : ""}`,
      parameters: z.object({
        message: z.string().describe("A clear, specific task description for this team member. Include: what to do, what format to return, and any context needed from previous results."),
      }),
      execute: async ({ message }: { message: string }) => {
        const { userId, sessionId, flowId } = context;

        // Publish agent_called event
        await publishProgress(sessionId, "agent_called", {
          agentName: info.name,
          webletId: step.webletId,
          iconUrl: info.iconUrl,
          role: step.role || null,
          message: message.slice(0, 200),
        });

        // Quota check
        const quota = await checkQuotas(userId, step.webletId);
        if (!quota.allowed) {
          const reason = quota.reason === "developer_credits_exhausted"
            ? `"${info.name}" is temporarily unavailable (creator quota exceeded).`
            : `Quota exceeded for "${info.name}".`;

          await publishProgress(sessionId, "agent_completed", {
            agentName: info.name,
            webletId: step.webletId,
            role: step.role || null,
            output: reason,
            error: true,
          });

          return { error: reason, source: info.name };
        }

        // Fetch weblet with all tool sources
        const weblet = await prisma.weblet.findUnique({
          where: { id: step.webletId },
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
          return { error: `Agent "${info.name}" not found`, source: info.name };
        }

        const activeVersion = await getActiveVersion(step.webletId);
        if (!activeVersion) {
          return { error: `No active configuration for "${info.name}"`, source: info.name };
        }

        // Build system prompt with role
        let systemPrompt = activeVersion.prompt;
        if (step.role) {
          systemPrompt = buildRolePrompt(
            activeVersion.prompt,
            step.role,
            `You are a specialist team member in a coordinator-led multi-agent workflow. A coordinator agent has delegated a specific sub-task to you based on your expertise.

YOUR RESPONSIBILITIES:
- Focus exclusively on the task described in the message you receive
- Use your available tools when they can improve the quality of your response
- Deliver a thorough, well-structured result that the coordinator can directly use
- If the task is ambiguous, state your interpretation before proceeding
- Do not add conversational filler — return only substantive, actionable output
- Format your response with clear structure (headings, lists, code blocks) for easy parsing`
          );
        } else {
          // Even without a role, add basic delegation context
          systemPrompt += `\n\nYou are operating as a specialist in a multi-agent workflow. A coordinator has delegated a specific task to you. Focus on completing it thoroughly, use your tools when helpful, and return a well-structured result.`;
        }
        if (step.stepPrompt?.trim()) {
          systemPrompt += `\n\nADDITIONAL INSTRUCTIONS FROM WORKFLOW CREATOR:\n${step.stepPrompt.trim()}`;
        }

        // Assemble tools
        let agentTools = getToolsFromCapabilities(weblet.capabilities, weblet.id);
        if (activeVersion.openapiSchema) {
          const customTools = getToolsFromOpenAPI(
            typeof activeVersion.openapiSchema === "string"
              ? activeVersion.openapiSchema
              : JSON.stringify(activeVersion.openapiSchema)
          );
          agentTools = { ...agentTools, ...customTools };
        }

        // MCP tools
        let mcpClients: Array<{ close: () => Promise<void> }> = [];
        if (weblet.mcpServers && weblet.mcpServers.length > 0) {
          try {
            const mcpResult = await getMCPTools(weblet.mcpServers, userId);
            agentTools = { ...agentTools, ...mcpResult.tools };
            mcpClients = mcpResult.clients;
          } catch (err) {
            console.warn(`[HybridTeam] MCP tools failed for ${info.name}:`, err);
          }
        }

        // Composition tools
        if (weblet.parentCompositions && weblet.parentCompositions.length > 0) {
          const childTools = createChildWebletTools(weblet.parentCompositions);
          agentTools = { ...agentTools, ...childTools };
        }

        const modelId = activeVersion.model || "meta-llama/llama-3.3-70b-instruct";
        const model = getLanguageModel(modelId);
        const hasTools = Object.keys(agentTools).length > 0;

        try {
          const result = await generateText({
            model,
            system: systemPrompt,
            messages: [{ role: "user", content: message }],
            ...(hasTools ? { tools: agentTools, stopWhen: stepCountIs(5) } : {}),
            experimental_telemetry: {
              isEnabled: true,
              metadata: {
                webletId: step.webletId,
                sessionId,
                flowId,
                mode: "HYBRID",
                role: step.role || "none",
              },
            },
          });

          await langfuseSpanProcessor.forceFlush();

          // Log usage
          const usage = result.usage as any;
          const tokensIn = usage?.promptTokens || 0;
          const tokensOut = usage?.completionTokens || 0;
          const toolCallsMap: Record<string, number> = {};

          if (result.steps && result.steps.length > 0) {
            for (const s of result.steps) {
              if (s.toolCalls && s.toolCalls.length > 0) {
                for (const tc of s.toolCalls) {
                  toolCallsMap[tc.toolName] = (toolCallsMap[tc.toolName] || 0) + 1;
                }
              }
            }
          }

          await logUsage({
            userId,
            webletId: step.webletId,
            developerId: weblet.developerId,
            sessionId,
            workflowId: flowId,
            tokensIn,
            tokensOut,
            modelId,
            toolCalls: Object.keys(toolCallsMap).length > 0 ? toolCallsMap : null,
            source: "ORCHESTRATION",
          });

          const responseText = result.text || "[No output generated]";

          await publishProgress(sessionId, "agent_completed", {
            agentName: info.name,
            webletId: step.webletId,
            iconUrl: info.iconUrl,
            role: step.role || null,
            output: responseText.slice(0, 500),
          });

          return { response: responseText, source: info.name };
        } catch (llmError: any) {
          console.error(`[HybridTeam] LLM error for ${info.name}:`, llmError?.message);

          await publishProgress(sessionId, "agent_completed", {
            agentName: info.name,
            webletId: step.webletId,
            role: step.role || null,
            output: `Error: ${llmError?.message || "Unknown error"}`,
            error: true,
          });

          return {
            error: `Failed to get response from ${info.name}: ${llmError?.message || "Unknown error"}`,
            source: info.name,
          };
        } finally {
          if (mcpClients.length > 0) {
            await closeMCPClients(mcpClients);
          }
        }
      },
    } as any);
  }

  return tools;
}
