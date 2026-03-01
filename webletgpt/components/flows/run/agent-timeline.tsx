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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChatMarkdown } from "@/components/ui/chat-markdown";
import { HitlApprovalCard } from "./hitl-approval-card";
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Bot,
  Lock,
  MessageSquare,
} from "lucide-react";

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
  revision: number;
  startedAt?: Date;
  completedAt?: Date;
  hitlPending?: boolean;
  hitlHistory: HitlRecord[];
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
              hitlHistory: [],
            });
          }
          break;
        }
        case "tool_call": {
          const num = ev.data.stepNumber;
          const existing = groups.get(num);
          if (existing) {
            existing.liveToolCalls.push({
              toolName: ev.data.toolName,
              args: ev.data.args || {},
              result: ev.data.result ?? null,
              state: ev.data.state === "completed" ? "completed" : "running",
            });
          }
          break;
        }
        case "step_completed": {
          const num = ev.data.stepNumber;
          const existing = groups.get(num);
          if (existing) {
            existing.status = "completed";
            existing.output = ev.data.output;
            for (const tc of existing.liveToolCalls) {
              tc.state = "completed";
            }
            existing.revision = ev.data.revision || existing.revision;
            existing.completedAt = ev.timestamp;
            if (ev.data.webletName) existing.webletName = ev.data.webletName;
            if (ev.data.role) existing.role = ev.data.role;
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
      stepGroups: Array.from(groups.values()).sort((a, b) => a.stepNumber - b.stepNumber),
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
        // Last agent in a completed flow shows output directly (no toggle)
        const showOutputDirectly = isLastStep && flowStatus === "completed";
        return (
          <StepTimelineItem
            key={group.stepNumber}
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
      className="w-5 h-5 rounded-full object-cover"
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
        <TimelineIcon className="h-8 w-8 bg-muted ring-1 ring-border">
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
            {group.status === "running" && (
              <Loader2 className="size-4 text-muted-foreground animate-spin" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Step {group.stepNumber}
            {timestamp && <> &middot; {new Date(timestamp).toLocaleTimeString()}</>}
            {" "}&middot; {inputLabel}
          </p>
        </div>

        {/* Running indicator */}
        {group.status === "running" && !hasOutput && group.liveToolCalls.length === 0 && (
          <p className="text-sm text-muted-foreground mt-3">
            Agent is working on this step...
          </p>
        )}

        {/* Tool calls — Vercel-style progressive toggles */}
        {group.liveToolCalls.length > 0 && (
          <div className="mt-3 space-y-1">
            {group.liveToolCalls.map((tc, idx) => (
              <FlowToolCallToggle key={idx} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Output — last step shows directly, others use collapsible */}
        {hasOutput && showOutputDirectly && (
          <div className="mt-3 rounded-lg border bg-card p-4">
            <ChatMarkdown content={group.output!} />
          </div>
        )}
        {hasOutput && !showOutputDirectly && (
          <Collapsible open={showOutput} onOpenChange={setShowOutput}>
            <CollapsibleTrigger asChild>
              <button className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <svg
                  className={cn(
                    "size-3 transition-transform duration-200",
                    showOutput && "rotate-90"
                  )}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {showOutput ? "Hide output" : "View output"}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border bg-card p-4">
                <ChatMarkdown content={group.output!} />
              </div>
            </CollapsibleContent>
          </Collapsible>
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

/* ── Flow Tool Call Toggle (Vercel-style) ── */

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

function FlowToolCallToggle({ toolCall }: { toolCall: LiveToolCall }) {
  const [open, setOpen] = useState(false);
  const { label, action } = formatFlowToolName(toolCall.toolName);
  const hasArgs = toolCall.args && Object.keys(toolCall.args).length > 0;
  const hasResult = toolCall.result !== null && toolCall.result !== undefined;
  const hasDetails = hasArgs || hasResult;
  const isLoading = toolCall.state === "running";

  return (
    <div className="my-0.5">
      <button
        onClick={() => hasDetails && setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full text-left py-1",
          hasDetails ? "cursor-pointer" : "cursor-default"
        )}
      >
        {/* Chevron */}
        <svg
          className={cn(
            "size-3 text-muted-foreground transition-transform duration-200 shrink-0",
            open && "rotate-90",
            !hasDetails && "opacity-0"
          )}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <span className="text-sm text-muted-foreground">
          {action ? `Used ${label}: ${action}` : `Used ${label}`}
        </span>

        {/* Spinner while running, checkmark when done */}
        {isLoading ? (
          <svg className="size-3.5 animate-spin text-muted-foreground shrink-0 ml-auto" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="size-3.5 text-muted-foreground shrink-0 ml-auto" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {open && (
        <div className="ml-2.5 border-l border-border pl-4 space-y-0.5">
          {/* Tool name detail */}
          <div className="flex items-center gap-2 py-1">
            <svg className="size-3.5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <span className="text-sm text-foreground font-mono truncate">
              {action || label}
            </span>
            <span className="text-xs text-muted-foreground truncate ml-auto">
              {label}
            </span>
          </div>

          {/* Input args */}
          {hasArgs && (
            <div className="py-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Input</span>
              <pre className="mt-1 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all font-mono bg-muted/50 rounded px-2.5 py-2 border">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {hasResult && (
            <div className="py-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Output</span>
              <pre className="mt-1 text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all font-mono bg-muted/50 rounded px-2.5 py-2 border max-h-52 overflow-y-auto">
                {formatFlowResult(toolCall.result)}
              </pre>
            </div>
          )}
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
