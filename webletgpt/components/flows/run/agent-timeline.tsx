"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Timeline,
  TimelineBody,
  TimelineHeader,
  TimelineIcon,
  TimelineItem,
  TimelineSeparator,
} from "@/components/ui/timeline";
import { Badge } from "@/components/ui/badge";
import { ChatMarkdown } from "@/components/ui/chat-markdown";
import { HitlApprovalCard } from "./hitl-approval-card";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Bot,
  Lock,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

export interface TimelineEvent {
  type: string;
  data: any;
  timestamp: Date;
}

interface AgentTimelineProps {
  events: TimelineEvent[];
  totalSteps: number;
  onHitlRespond: (action: "approve" | "reject", feedback?: string) => void;
}

interface HitlRecord {
  action: "approved" | "rejected";
  feedback?: string;
  willRevise?: boolean;
}

interface LiveToolCall {
  toolName: string;
  args: Record<string, any>;
  result: any;
  state: "running" | "completed";
}

interface AgentActivity {
  type: "text" | "tool_call";
  text?: string;
  toolCall?: LiveToolCall;
}

interface StepGroup {
  stepNumber: number;
  webletName: string;
  webletId?: string;
  iconUrl?: string | null;
  role?: string | null;
  inputMapping?: string;
  status: "running" | "completed" | "failed" | "waiting";
  output?: string;
  liveToolCalls: LiveToolCall[];
  activities: AgentActivity[];
  revision: number;
  startedAt?: Date;
  completedAt?: Date;
  hitlPending?: boolean;
  hitlHistory: HitlRecord[];
  agentStatus?: "complete" | "needs_review" | "blocked";
}

export function AgentTimeline({ events, totalSteps, onHitlRespond }: AgentTimelineProps) {
  const { stepGroups, flowStatus, flowMessage, finalOutput } = useMemo(() => {
    const groups: Map<number, StepGroup> = new Map();
    let status: "idle" | "running" | "completed" | "failed" = "idle";
    let message = "";
    let final = "";

    for (const ev of events) {
      switch (ev.type) {
        case "started":
          status = "running";
          message = ev.data.message;
          break;

        case "step_started":
        case "step_revision": {
          const num = ev.data.stepNumber;
          const existing = groups.get(num);
          if (existing) {
            existing.status = "running";
            existing.revision = ev.data.revision || 0;
            existing.output = undefined;
          } else {
            groups.set(num, {
              stepNumber: num,
              webletName: ev.data.webletName || `Agent ${num}`,
              webletId: ev.data.webletId,
              iconUrl: ev.data.iconUrl || null,
              role: ev.data.role,
              inputMapping: ev.data.inputMapping,
              status: "running",
              revision: ev.data.revision || 0,
              startedAt: ev.timestamp,
              liveToolCalls: [],
              activities: [],
              hitlHistory: [],
            });
          }
          break;
        }

        case "tool_call": {
          const num = ev.data.stepNumber;
          const existing = groups.get(num);
          if (existing) {
            const tc: LiveToolCall = {
              toolName: ev.data.toolName,
              args: ev.data.args || {},
              result: ev.data.result ?? null,
              state: ev.data.state === "completed" ? "completed" : "running",
            };
            existing.liveToolCalls.push(tc);
            existing.activities.push({ type: "tool_call", toolCall: tc });
          }
          break;
        }

        case "step_completed": {
          const num = ev.data.stepNumber;
          const existing = groups.get(num);
          if (existing) {
            existing.status = "completed";
            existing.output = ev.data.output;
            for (const tc of existing.liveToolCalls) tc.state = "completed";
            existing.revision = ev.data.revision || existing.revision;
            existing.completedAt = ev.timestamp;
            if (ev.data.webletName) existing.webletName = ev.data.webletName;
            if (ev.data.role) existing.role = ev.data.role;
            if (ev.data.status) existing.agentStatus = ev.data.status;
          }
          break;
        }

        case "hitl_required": {
          const num = ev.data.stepNumber;
          const existing = groups.get(num);
          if (existing) existing.hitlPending = true;
          break;
        }

        case "hitl_completed": {
          for (const [, g] of groups) {
            if (g.hitlPending) {
              g.hitlPending = false;
              g.hitlHistory.push({
                action: ev.data.action || "approved",
                feedback: ev.data.feedback || undefined,
                willRevise: ev.data.willRevise || false,
              });
            }
          }
          break;
        }

        case "agent_text": {
          const num = ev.data.stepNumber;
          const existing = groups.get(num);
          if (existing && ev.data.text) {
            const lastActivity = existing.activities[existing.activities.length - 1];
            if (lastActivity && lastActivity.type === "text") {
              lastActivity.text += ev.data.text;
            } else {
              existing.activities.push({ type: "text", text: ev.data.text });
            }
          }
          break;
        }

        case "completed":
          status = "completed";
          final = ev.data.finalOutput || "";
          break;

        case "failed":
          status = "failed";
          message = ev.data.message;
          break;
      }
    }

    return {
      stepGroups: Array.from(groups.values()).sort((a, b) => {
        const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return timeA - timeB;
      }),
      flowStatus: status,
      flowMessage: message,
      finalOutput: final,
    };
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Waiting for execution to begin...
      </div>
    );
  }

  return (
    <Timeline color="secondary" orientation="vertical">
      {stepGroups.map((group, idx) => {
        const isLastStep = idx === stepGroups.length - 1;
        const isLast = isLastStep && flowStatus !== "completed" && flowStatus !== "failed";
        const showOutputDirectly = isLastStep && flowStatus === "completed";
        return (
          <StepTimelineItem
            key={`${group.stepNumber}-${idx}`}
            group={group}
            isLast={isLast}
            showOutputDirectly={showOutputDirectly}
            onHitlRespond={onHitlRespond}
          />
        );
      })}

      {/* Failed */}
      {flowStatus === "failed" && (
        <TimelineItem>
          <TimelineHeader>
            <TimelineIcon className="h-8 w-8 bg-destructive">
              <XCircle className="w-4 h-4 text-destructive-foreground" />
            </TimelineIcon>
          </TimelineHeader>
          <TimelineBody className="mt-0.5">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-destructive">Workflow Failed</h3>
              <p className="text-sm text-muted-foreground">{flowMessage}</p>
            </div>
          </TimelineBody>
        </TimelineItem>
      )}
    </Timeline>
  );
}

/* ── Agent Icon ── */

function AgentIcon({ iconUrl, name }: { iconUrl?: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);

  const src = iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(name)}&size=64`;

  if (imgError) {
    return <Bot className="w-4 h-4 text-muted-foreground" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="w-full h-full rounded-full object-cover bg-background"
      onError={() => setImgError(true)}
    />
  );
}

/* ── Individual Step Item ── */

function StepTimelineItem({
  group,
  isLast,
  showOutputDirectly,
  onHitlRespond,
}: {
  group: StepGroup;
  isLast: boolean;
  showOutputDirectly?: boolean;
  onHitlRespond: (action: "approve" | "reject", feedback?: string) => void;
}) {
  const [showOutput, setShowOutput] = useState(false);

  const hasOutput = !!group.output;
  const timestamp = group.completedAt || group.startedAt;
  const inputLabel =
    group.inputMapping === "original"
      ? "Using original prompt"
      : `Using output from Step ${group.stepNumber - 1}`;

  return (
    <TimelineItem>
      <TimelineHeader>
        <TimelineIcon className="h-8 w-8 bg-background border border-border p-0 overflow-hidden">
          <AgentIcon iconUrl={group.iconUrl} name={group.webletName} />
        </TimelineIcon>
        {!isLast && <TimelineSeparator />}
      </TimelineHeader>
      <TimelineBody className="mt-0.5">
        {/* Title row */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">{group.webletName}</h3>
            {group.role && (
              <Badge variant="secondary" className="text-xs py-0 px-1.5 font-medium uppercase tracking-wider">
                {group.role}
              </Badge>
            )}
            {group.status === "completed" && (
              <CheckCircle2 className="size-4 text-emerald-500" />
            )}
            {group.status === "running" && (
              <Loader2 className="size-4 text-muted-foreground animate-spin" />
            )}
            {group.status === "failed" && (
              <XCircle className="size-4 text-destructive" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {`Step ${group.stepNumber}`}
            {timestamp && <> &middot; {new Date(timestamp).toLocaleTimeString()}</>}
            <> &middot; {inputLabel}</>
            {group.status === "completed" && group.agentStatus && group.agentStatus !== "complete" && (
              <> &middot; <span className={cn(
                group.agentStatus === "needs_review" && "text-amber-500",
                group.agentStatus === "blocked" && "text-red-500",
              )}>{group.agentStatus === "needs_review" ? "needs review" : "blocked"}</span></>
            )}
          </p>
        </div>

        {/* Running indicator */}
        {group.status === "running" && !hasOutput && group.activities.length === 0 && (
          <p className="text-sm text-muted-foreground mt-3">
            Agent is working on this step...
          </p>
        )}

        {/* Activities — interleaved text, tool calls, and agent handoffs */}
        {group.activities.length > 0 && (
          <div className="mt-3 space-y-2">
            {renderActivities(
              group.status === "completed" && group.output
                ? group.activities.filter(a => a.type !== "text")
                : group.activities
            )}
          </div>
        )}

        {/* Completed intermediate step — show output directly */}
        {group.status === "completed" && hasOutput && !showOutputDirectly && (
          <div className="mt-3">
            <div className="rounded-lg border bg-card p-4">
              <ChatMarkdown content={group.output!} />
            </div>
          </div>
        )}

        {/* Final step output — shown directly */}
        {hasOutput && showOutputDirectly && (
          <div className="mt-3 rounded-lg border bg-card p-4">
            <ChatMarkdown content={group.output!} />
          </div>
        )}

        {/* HITL History */}
        {group.hitlHistory.map((record, idx) => (
          <div key={idx} className="mt-3">
            <HitlResolvedCard
              action={record.action}
              feedback={record.feedback}
              stepNumber={group.stepNumber}
              willRevise={record.willRevise}
              revision={idx + 1}
            />
          </div>
        ))}

        {/* Revision indicator */}
        {group.revision > 0 && group.status === "running" && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Refining output with feedback (revision {group.revision})...
          </div>
        )}

        {/* Active HITL prompt */}
        {group.hitlPending && (
          <div className="mt-3">
            <HitlApprovalCard
              stepNumber={group.stepNumber}
              onRespond={onHitlRespond}
            />
          </div>
        )}
      </TimelineBody>
    </TimelineItem>
  );
}

/* ── Render interleaved activities (text + tool calls) ── */

function renderActivities(activities: AgentActivity[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < activities.length) {
    const act = activities[i];

    if (act.type === "text" && act.text) {
      const textParts: string[] = [act.text];
      i++;
      while (i < activities.length && activities[i].type === "text" && activities[i].text) {
        textParts.push(activities[i].text!);
        i++;
      }
      elements.push(
        <div key={`text-${i}`} className="text-sm text-muted-foreground">
          <ChatMarkdown content={textParts.join("\n\n")} />
        </div>
      );
    } else if (act.type === "tool_call" && act.toolCall) {
      const toolCalls: LiveToolCall[] = [];
      while (i < activities.length && activities[i].type === "tool_call" && activities[i].toolCall) {
        toolCalls.push(activities[i].toolCall!);
        i++;
      }
      const grouped = groupToolCalls(toolCalls);
      for (let g = 0; g < grouped.length; g++) {
        elements.push(
          <GroupedToolCallToggle key={`tc-${i}-${g}`} group={grouped[g]} />
        );
      }
    } else {
      i++;
    }
  }

  return elements;
}

/* ── Tool Call Toggle ── */

/** Friendly display names for built-in capability tools */
const TOOL_DISPLAY_NAMES: Record<string, { label: string; action: string }> = {
  webSearch: { label: "Web Search", action: "Searching the web" },
  codeInterpreter: { label: "Code Interpreter", action: "Running code" },
  imageGeneration: { label: "Image Generation", action: "Generating image" },
  fileSearch: { label: "File Search", action: "Searching files" },
};

/** Split camelCase into readable words: "webSearch" → "Web Search" */
function camelToTitle(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatFlowToolName(name: string): { label: string; action: string } {
  // Built-in capability tools (camelCase)
  if (TOOL_DISPLAY_NAMES[name]) {
    return TOOL_DISPLAY_NAMES[name];
  }

  // MCP tools: mcp_server_toolname
  if (name.startsWith("mcp_")) {
    const withoutPrefix = name.slice(4);
    const firstUnderscore = withoutPrefix.indexOf("_");
    if (firstUnderscore > 0) {
      const server = withoutPrefix.slice(0, firstUnderscore).replace(/_/g, " ");
      const action = withoutPrefix.slice(firstUnderscore + 1).replace(/_/g, " ");
      return {
        label: server.charAt(0).toUpperCase() + server.slice(1),
        action,
      };
    }
    return { label: "MCP", action: withoutPrefix.replace(/_/g, " ") };
  }

  // Composition tools: weblet_slug_name
  if (name.startsWith("weblet_")) {
    const slug = name.slice(7).replace(/_/g, " ");
    return { label: "Weblet", action: slug.charAt(0).toUpperCase() + slug.slice(1) };
  }

  // OpenAPI tools: get_users, post_create_order
  if (/^(get|post|put|patch|delete)_/.test(name)) {
    const firstUnderscore = name.indexOf("_");
    const method = name.slice(0, firstUnderscore).toUpperCase();
    const path = name.slice(firstUnderscore + 1).replace(/_/g, " ");
    return { label: "API", action: `${method} ${path}` };
  }

  // Fallback: handle both camelCase and snake_case
  if (name.includes("_")) {
    const words = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: words, action: "" };
  }

  return { label: camelToTitle(name), action: "" };
}

function formatFlowResult(result: unknown): string {
  if (result === undefined || result === null) return "";
  if (typeof result === "string") {
    return result.length > 600 ? result.slice(0, 600) + "..." : result;
  }
  try {
    const json = JSON.stringify(result, null, 2);
    return json.length > 600 ? json.slice(0, 600) + "..." : json;
  } catch {
    return String(result);
  }
}

interface ToolCallGroup {
  id: string;
  label: string;
  state: "running" | "completed";
  calls: LiveToolCall[];
}

function groupToolCalls(calls: LiveToolCall[]): ToolCallGroup[] {
  const groups: ToolCallGroup[] = [];

  for (const call of calls) {
    const { label } = formatFlowToolName(call.toolName);
    const lastGroup = groups[groups.length - 1];

    // Group adjacent calls that have the same base label (e.g. "Github")
    if (lastGroup && lastGroup.label === label) {
      lastGroup.calls.push(call);
      if (call.state === "running") lastGroup.state = "running";
    } else {
      groups.push({
        id: Math.random().toString(),
        label,
        state: call.state,
        calls: [call],
      });
    }
  }
  return groups;
}

function GroupedToolCallToggle({ group }: { group: ToolCallGroup }) {
  const [open, setOpen] = useState(false);
  const isLoading = group.state === "running";
  const count = group.calls.length;

  const singleAction = count === 1 ? formatFlowToolName(group.calls[0].toolName).action : "";
  const summaryText = count === 1 && singleAction
    ? `${group.label}: ${singleAction}`
    : `${group.label}${count > 1 ? ` (${count} calls)` : ""}`;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={cn(
        "flex items-center gap-1.5 w-full py-1 px-2 rounded-md text-sm transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-muted/40",
        open && "text-foreground"
      )}>
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-150", open && "rotate-90")} />
        {isLoading
          ? <Loader2 className="size-3.5 shrink-0 animate-spin" />
          : <span className="size-3.5 shrink-0" />}
        <span className="truncate">{summaryText}</span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-5 mt-1 border-l-2 border-border/50 pl-4 pb-2 space-y-4">
          {group.calls.map((call, i) => (
            <IndividualToolCall key={i} toolCall={call} hideHeader={count === 1} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function IndividualToolCall({ toolCall, hideHeader }: { toolCall: LiveToolCall, hideHeader?: boolean }) {
  const { label, action } = formatFlowToolName(toolCall.toolName);
  const hasArgs = toolCall.args && Object.keys(toolCall.args).length > 0;
  const hasResult = toolCall.result !== null && toolCall.result !== undefined;

  return (
    <div className="space-y-2 overflow-hidden">
      {!hideHeader && (
        <div className="flex items-center gap-2">
          <div className={cn(
            "size-1.5 rounded-full shrink-0",
            toolCall.state === "running" ? "bg-amber-500 animate-pulse" : "bg-foreground/30"
          )} />
          <span className="text-sm font-medium text-foreground">
            {action || label}
          </span>
          {toolCall.state === "running" && <Loader2 className="size-3 animate-spin text-muted-foreground ml-1" />}
        </div>
      )}

      {hasArgs && (
        <div className={cn(!hideHeader && "pl-3.5")}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Input</div>
          <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-all font-mono bg-muted/30 rounded-lg px-3 py-2 border border-border/40">
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
        </div>
      )}

      {hasResult && (
        <div className={cn(!hideHeader && "pl-3.5")}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1 pt-0.5">Output</div>
          <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-all font-mono bg-muted/30 rounded-lg px-3 py-2 border border-border/40 max-h-52 overflow-y-auto">
            {formatFlowResult(toolCall.result)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── HITL Resolved Card (locked, read-only) ── */

function HitlResolvedCard({
  action,
  feedback,
  stepNumber,
  willRevise,
  revision,
}: {
  action: "approved" | "rejected";
  feedback?: string;
  stepNumber: number;
  willRevise?: boolean;
  revision?: number;
}) {
  const isApproved = action === "approved";

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden opacity-80",
      isApproved
        ? "border-border bg-muted/30"
        : "border-destructive/30 bg-destructive/5"
    )}>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="size-3.5 text-muted-foreground" />
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 text-xs",
              isApproved
                ? "border-border text-foreground"
                : "border-destructive/30 text-destructive"
            )}
          >
            {isApproved ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <XCircle className="size-3" />
            )}
            {isApproved ? "Approved" : "Rejected"}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Step {stepNumber} review{revision ? ` #${revision}` : ""}
            {willRevise ? " — sent back for revision" : " completed"}
          </span>
        </div>
        {feedback && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MessageSquare className="size-3 mt-0.5 shrink-0" />
            <p className="italic">&ldquo;{feedback}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}

