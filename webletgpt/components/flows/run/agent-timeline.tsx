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
  Download,
  FileIcon,
  TerminalSquare,
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
  artifacts?: { kind: string; displayName: string; url: string | null }[];
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
            if (ev.data.artifacts) existing.artifacts = ev.data.artifacts;
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
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-5 animate-in fade-in duration-700">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-50 duration-1000"></div>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 backdrop-blur-sm shadow-sm">
            <Loader2 className="h-6 w-6 text-zinc-400 dark:text-zinc-500 animate-spin" />
          </div>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-[15px] font-medium tracking-tight text-zinc-900 dark:text-zinc-100">Waiting for execution</h3>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 font-mono">Live events will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full antialiased font-sans">
      <Timeline orientation="vertical" className="w-full">
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
              <TimelineIcon className="h-8 w-8 bg-transparent border-none p-0 overflow-visible z-10 flex items-center justify-center">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border border-destructive/30 bg-destructive/10">
                  <XCircle className="w-4 h-4 text-destructive" />
                </div>
              </TimelineIcon>
            </TimelineHeader>
            <TimelineBody className="mt-1 pb-2">
              <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-300">
                <h3 className="text-[15px] font-semibold tracking-tight text-destructive">Workflow Failed</h3>
                <p className="text-[13px] text-destructive/80 font-mono bg-destructive/5 px-3 py-2 rounded-md border border-destructive/20">{flowMessage}</p>
              </div>
            </TimelineBody>
          </TimelineItem>
        )}
      </Timeline>
    </div>
  );
}

/* ── Agent Icon ── */

function AgentIcon({ iconUrl, name, status }: { iconUrl?: string | null; name: string; status: StepGroup["status"] }) {
  const [imgError, setImgError] = useState(false);
  const src = iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(name)}&size=64`;

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {status === "running" && (
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75 duration-1000" />
      )}
      <div className={cn(
        "relative z-10 w-full h-full rounded-full overflow-hidden border-2 bg-background transition-all duration-500",
        status === "running" ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)]" : "border-border/50",
        status === "completed" && "border-emerald-500/30"
      )}>
        {imgError ? (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-900 text-zinc-400">
            <Bot className="w-4 h-4" />
          </div>
        ) : (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )}
      </div>
    </div>
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
  const hasOutput = !!group.output;
  const timestamp = group.completedAt || group.startedAt;
  const inputLabel =
    group.inputMapping === "original"
      ? "Using original prompt"
      : `Using output from Step ${group.stepNumber - 1}`;

  return (
    <TimelineItem>
      <TimelineHeader>
        <TimelineIcon className="h-8 w-8 bg-transparent border-none p-0 overflow-visible z-10">
          <AgentIcon iconUrl={group.iconUrl} name={group.webletName} status={group.status} />
        </TimelineIcon>
        {!isLast && <TimelineSeparator className={cn(
          "transition-colors duration-500 w-[2px]",
          group.status === "completed" ? "bg-primary/20 dark:bg-primary/10" : "bg-border/40"
        )} />}
      </TimelineHeader>
      <TimelineBody className="mt-1 pb-8 w-full max-w-full overflow-hidden">
        {/* Title row */}
        <div className="flex flex-col space-y-1.5 transition-opacity duration-300">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className={cn(
              "text-[15px] font-semibold tracking-tight transition-colors duration-300",
              group.status === "running" ? "text-foreground" : "text-foreground/80",
              group.status === "failed" && "text-destructive"
            )}>
              {group.webletName}
            </h3>
            
            {group.role && (
              <Badge variant="outline" className="text-[10px] py-0 h-5 px-2 font-medium uppercase tracking-wider bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700">
                {group.role}
              </Badge>
            )}

            <div className="flex items-center ml-auto md:ml-0 gap-2">
              {group.status === "completed" && (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 animate-in fade-in zoom-in duration-300">
                  <CheckCircle2 className="size-4" />
                  <span className="text-xs font-medium hidden sm:inline-block">Completed</span>
                </div>
              )}
              {group.status === "running" && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="text-xs font-medium animate-pulse hidden sm:inline-block">Running</span>
                </div>
              )}
              {group.status === "failed" && (
                <div className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="size-4" />
                  <span className="text-xs font-medium">Failed</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground/70 font-mono">
            <span>{`Step ${group.stepNumber}`}</span>
            {timestamp && (
              <>
                <span className="text-border/60">•</span>
                <span>{new Date(timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </>
            )}
            <span className="text-border/60">•</span>
            <span className="truncate max-w-[200px] sm:max-w-none" title={inputLabel}>{inputLabel}</span>
            
            {group.status === "completed" && group.agentStatus && group.agentStatus !== "complete" && (
              <>
                <span className="text-border/60">•</span>
                <span className={cn(
                  "font-medium tracking-wide uppercase text-[10px]",
                  group.agentStatus === "needs_review" ? "text-amber-500" : "text-red-500",
                )}>
                  {group.agentStatus.replace('_', ' ')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Running indicator */}
        {group.status === "running" && !hasOutput && group.activities.length === 0 && (
          <div className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground animate-pulse">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>Agent is starting...</span>
          </div>
        )}

        {/* Activities — interleaved text, tool calls, and agent handoffs */}
        {group.activities.length > 0 && (
          <div className="mt-4 space-y-3">
            {renderActivities(
              group.status === "completed" && group.output
                ? group.activities.filter(a => a.type !== "text")
                : group.activities,
              group.status === "running"
            )}
          </div>
        )}

        {/* Completed intermediate step — show output directly */}
        {group.status === "completed" && hasOutput && !showOutputDirectly && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <Collapsible className="group/output border border-border/40 rounded-lg bg-zinc-50/30 dark:bg-zinc-900/20 overflow-hidden transition-all duration-200">
              <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] transition-colors hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50">
                <ChevronRight className="size-4 text-zinc-400 group-data-[state=open]/output:rotate-90 transition-transform duration-200" />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">View Final Output</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4 border-t border-border/40 bg-card text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <ChatMarkdown content={group.output!} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Final step output — shown directly */}
        {hasOutput && showOutputDirectly && (
          <div className="mt-4 rounded-xl border border-border/50 bg-card/50 p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-200">
              <ChatMarkdown content={group.output!} />
            </div>
          </div>
        )}

        {/* Artifacts section */}
        {group.artifacts && group.artifacts.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Artifacts</div>
            <div className="flex flex-wrap gap-2.5">
              {group.artifacts.map((art, i) => {
                if ((art.kind === 'image' || art.kind === 'chart') && art.url) {
                  return (
                    <a key={i} href={art.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-primary/50 transition-all">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={art.url}
                        alt={art.displayName}
                        className="max-w-[200px] max-h-[150px] object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                    </a>
                  );
                }
                if (art.kind === 'file' && art.url) {
                  return (
                    <a
                      key={i}
                      href={art.url}
                      download={art.displayName}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm"
                    >
                      <FileIcon className="size-4 text-primary/70" />
                      <span className="truncate max-w-[150px]">{art.displayName}</span>
                      <Download className="size-3.5 text-zinc-400" />
                    </a>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {/* HITL History */}
        {group.hitlHistory.map((record, idx) => (
          <div key={idx} className="mt-4">
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
          <div className="mt-3 flex items-center gap-2 text-[13px] text-amber-600/80 dark:text-amber-500/80 animate-pulse">
            <Loader2 className="size-4 animate-spin" />
            Refining output with feedback (revision {group.revision})...
          </div>
        )}

        {/* Active HITL prompt */}
        {group.hitlPending && (
          <div className="mt-4 animate-in zoom-in-95 duration-300">
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

function renderActivities(activities: AgentActivity[], isRunning: boolean): React.ReactNode[] {
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
      
      const isLastActivity = i === activities.length;
      
      elements.push(
        <div key={`text-${i}`} className="relative group text-[14px] leading-relaxed text-zinc-800 dark:text-zinc-200">
          <div className="pl-4 border-l-[3px] border-zinc-200 dark:border-zinc-800 transition-colors duration-300 group-hover:border-primary/30">
            <ChatMarkdown content={textParts.join("\n\n")} />
            {isRunning && isLastActivity && (
              <span className="inline-block w-2 h-4 ml-1 align-middle bg-primary/70 animate-pulse" />
            )}
          </div>
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
          <div key={`tc-${i}-${g}`} className="my-1.5">
            <GroupedToolCallToggle group={grouped[g]} />
          </div>
        );
      }
    } else {
      i++;
    }
  }

  return elements;
}

/* ── Tool Call Toggle ── */

const TOOL_DISPLAY_NAMES: Record<string, { label: string; action: string }> = {
  webSearch: { label: "Web Search", action: "Searching the web" },
  codeInterpreter: { label: "Code Interpreter", action: "Running code" },
  imageGeneration: { label: "Image Generation", action: "Generating image" },
  fileSearch: { label: "File Search", action: "Searching files" },
};

function camelToTitle(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatFlowToolName(name: string): { label: string; action: string } {
  if (TOOL_DISPLAY_NAMES[name]) return TOOL_DISPLAY_NAMES[name];

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

  if (name.startsWith("weblet_")) {
    const slug = name.slice(7).replace(/_/g, " ");
    return { label: "Weblet", action: slug.charAt(0).toUpperCase() + slug.slice(1) };
  }

  if (/^(get|post|put|patch|delete)_/.test(name)) {
    const firstUnderscore = name.indexOf("_");
    const method = name.slice(0, firstUnderscore).toUpperCase();
    const path = name.slice(firstUnderscore + 1).replace(/_/g, " ");
    return { label: "API", action: `${method} ${path}` };
  }

  if (name.includes("_")) {
    const words = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: words, action: "" };
  }

  return { label: camelToTitle(name), action: "" };
}

function formatFlowResult(result: unknown): string {
  if (result === undefined || result === null) return "";
  if (typeof result === "string") {
    return result.length > 2000 ? result.slice(0, 2000) + "...\n[Output truncated]" : result;
  }
  try {
    const json = JSON.stringify(result, null, 2);
    return json.length > 2000 ? json.slice(0, 2000) + "...\n[Output truncated]" : json;
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
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible border border-border/40 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/20 overflow-hidden transition-all duration-200">
      <CollapsibleTrigger className={cn(
        "flex items-center gap-2 w-full px-3 py-2.5 text-[13px] font-mono transition-colors",
        "text-zinc-600 dark:text-zinc-400 hover:text-foreground hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50",
        open && "bg-zinc-100/50 dark:bg-zinc-800/50 text-foreground border-b border-border/40"
      )}>
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-200 text-zinc-400", open && "rotate-90")} />
        
        {isLoading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-amber-500" />
        ) : (
          <TerminalSquare className="size-3.5 shrink-0 text-primary/60" />
        )}
        
        <span className="truncate font-medium">{summaryText}</span>
        
        {isLoading && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-500/80 animate-pulse">Running</span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="animate-in slide-in-from-top-1 fade-in duration-200">
        <div className="divide-y divide-border/30">
          {group.calls.map((call, i) => (
            <div key={i} className="p-3 bg-zinc-50/30 dark:bg-[#09090b]">
              <IndividualToolCall toolCall={call} hideHeader={count === 1} />
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ToolResultRenderer({ toolName, result }: { toolName: string; result: any }) {
  if (toolName === "codeInterpreter" && result?.data) {
    const images: { format: string; url: string }[] = result.data.images || [];
    const files: { name: string; url: string }[] = result.data.files || [];
    const stdout = result.data.fullStdout || result.stdout || "";
    const error = result.error || "";

    return (
      <div className="space-y-3">
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-primary/50 transition-all">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={`Chart ${i + 1}`} className="max-w-[280px] max-h-[200px] object-contain transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
              </a>
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <a key={i} href={file.url} download={file.name} className="inline-flex items-center gap-2 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all shadow-sm">
                <FileIcon className="size-4 text-primary/70" />
                <span className="truncate max-w-[180px]">{file.name}</span>
                <Download className="size-3.5 text-zinc-400" />
              </a>
            ))}
          </div>
        )}
        {stdout && (
          <pre className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all bg-zinc-100/50 dark:bg-zinc-900/50 rounded border border-zinc-200/50 dark:border-zinc-800/50 px-3 py-2.5 max-h-52 overflow-y-auto">
            {stdout.length > 2000 ? stdout.slice(0, 2000) + "...\n[Output truncated]" : stdout}
          </pre>
        )}
        {error && (
          <pre className="text-[12px] leading-relaxed text-red-600 dark:text-red-400 whitespace-pre-wrap break-all bg-red-50 dark:bg-red-950/20 rounded border border-red-100 dark:border-red-900/30 px-3 py-2.5 max-h-40 overflow-y-auto">
            {error.length > 1000 ? error.slice(0, 1000) + "...\n[Error truncated]" : error}
          </pre>
        )}
      </div>
    );
  }

  if (toolName === "imageGeneration" && result?.url) {
    return (
      <div className="mt-1">
        <a href={result.url} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-md border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-primary/50 transition-all inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.url} alt="Generated image" className="max-w-[320px] max-h-[240px] object-contain transition-transform duration-300 group-hover:scale-105" />
        </a>
      </div>
    );
  }

  if (toolName.startsWith("weblet_") && result) {
    const response = result.response || result.text || "";
    if (response) {
      return (
        <div className="text-[13px] text-zinc-700 dark:text-zinc-300 border-l-2 border-primary/40 pl-3 py-1 font-sans bg-zinc-50/50 dark:bg-zinc-900/30 rounded-r pr-3">
          <ChatMarkdown content={response.length > 1500 ? response.slice(0, 1500) + "...\n[Response truncated]" : response} />
        </div>
      );
    }
  }

  const formatted = formatFlowResult(result);
  if (!formatted) return null;

  return (
    <pre className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all bg-zinc-100/50 dark:bg-zinc-900/50 rounded border border-zinc-200/50 dark:border-zinc-800/50 px-3 py-2.5 max-h-64 overflow-y-auto">
      {formatted}
    </pre>
  );
}

function IndividualToolCall({ toolCall, hideHeader }: { toolCall: LiveToolCall, hideHeader?: boolean }) {
  const { label, action } = formatFlowToolName(toolCall.toolName);
  const hasArgs = toolCall.args && Object.keys(toolCall.args).length > 0;
  const hasResult = toolCall.result !== null && toolCall.result !== undefined;

  return (
    <div className="space-y-3 font-mono text-[13px]">
      {!hideHeader && (
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
          <div className={cn(
            "size-2 rounded-sm shrink-0",
            toolCall.state === "running" ? "bg-amber-500 animate-pulse" : "bg-primary/60"
          )} />
          <span className="font-medium">
            {action || label}
          </span>
          {toolCall.state === "running" && <Loader2 className="size-3.5 animate-spin text-muted-foreground ml-1" />}
        </div>
      )}

      {hasArgs && (
        <div className={cn("space-y-1.5", !hideHeader && "pl-4")}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span className="w-3 border-t border-zinc-300 dark:border-zinc-700"></span>
            Input
          </div>
          <pre className="text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-all bg-zinc-100/50 dark:bg-zinc-900/50 rounded border border-zinc-200/50 dark:border-zinc-800/50 px-3 py-2.5 overflow-x-auto">
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
        </div>
      )}

      {hasResult && (
        <div className={cn("space-y-1.5", !hideHeader && "pl-4")}>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            <span className="w-3 border-t border-zinc-300 dark:border-zinc-700"></span>
            Output
          </div>
          <ToolResultRenderer toolName={toolCall.toolName} result={toolCall.result} />
        </div>
      )}
    </div>
  );
}

/* ── HITL Resolved Card ── */

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
      "rounded-lg border overflow-hidden transition-all",
      isApproved
        ? "border-border/50 bg-zinc-50/50 dark:bg-zinc-900/30"
        : "border-destructive/30 bg-destructive/5"
    )}>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Lock className="size-3.5 text-muted-foreground/70" />
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 text-[11px] font-medium h-6",
              isApproved
                ? "border-border text-foreground"
                : "border-destructive/30 text-destructive"
            )}
          >
            {isApproved ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {isApproved ? "Approved" : "Rejected"}
          </Badge>
          <span className="text-[13px] text-muted-foreground font-mono">
            Step {stepNumber} review{revision ? ` #${revision}` : ""}
            {willRevise ? " — sent back for revision" : " completed"}
          </span>
        </div>
        {feedback && (
          <div className="flex items-start gap-2 text-[13px] text-muted-foreground/90 bg-background/50 p-2.5 rounded-md border border-border/30">
            <MessageSquare className="size-3.5 mt-0.5 shrink-0 text-primary/60" />
            <p className="italic leading-relaxed">&ldquo;{feedback}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}
