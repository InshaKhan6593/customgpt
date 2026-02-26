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
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Sparkles,
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

interface StepGroup {
  stepNumber: number;
  webletName: string;
  webletId?: string;
  iconUrl?: string | null;
  role?: string | null;
  inputMapping?: string;
  status: "running" | "completed" | "failed" | "waiting";
  output?: string;
  revision: number;
  startedAt?: Date;
  completedAt?: Date;
  hitlPending?: boolean;
  hitlHistory: HitlRecord[];  // All HITL responses for this step
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
            // Revision — keep history, update status
            existing.status = "running";
            existing.revision = ev.data.revision || 0;
            existing.output = undefined; // Clear previous output while refining
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
              hitlHistory: [],
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
      {/* Agent Steps */}
      {stepGroups.map((group, idx) => {
        const isLast = idx === stepGroups.length - 1 && flowStatus !== "completed" && flowStatus !== "failed";
        return (
          <StepTimelineItem
            key={group.stepNumber}
            group={group}
            isLast={isLast}
            onHitlRespond={onHitlRespond}
          />
        );
      })}

      {/* Final Output */}
      {flowStatus === "completed" && finalOutput && (
        <TimelineItem>
          <TimelineHeader>
            <TimelineIcon className="h-8 w-8 bg-zinc-900 dark:bg-zinc-100">
              <CheckCircle2 className="w-4 h-4 text-zinc-100 dark:text-zinc-900" />
            </TimelineIcon>
          </TimelineHeader>
          <TimelineBody className="mt-0.5">
            <div className="space-y-1">
              <h3 className="text-base leading-none font-semibold">Workflow Complete</h3>
              <p className="text-muted-foreground text-xs">
                All {stepGroups.length} agents finished successfully
              </p>
            </div>
            <div className="mt-3 rounded-lg border bg-card p-5 shadow-sm">
              <ChatMarkdown content={finalOutput} />
            </div>
          </TimelineBody>
        </TimelineItem>
      )}

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
              <h3 className="text-base leading-none font-semibold text-destructive">
                Workflow Failed
              </h3>
              <p className="text-muted-foreground text-xs">{flowMessage}</p>
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

  // Use provided iconUrl, or generate a dicebear bottts avatar from the name
  const src = iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(name)}&size=64`;

  if (imgError) {
    return <Bot className="w-4 h-4 text-zinc-100 dark:text-zinc-900" />;
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
  onHitlRespond,
}: {
  group: StepGroup;
  isLast: boolean;
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
        <TimelineIcon className="h-8 w-8 bg-zinc-800 dark:bg-zinc-200">
          <AgentIcon iconUrl={group.iconUrl} name={group.webletName} />
        </TimelineIcon>
        {!isLast && <TimelineSeparator />}
      </TimelineHeader>
      <TimelineBody className="mt-0.5">
        {/* Title row */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base leading-none font-semibold">{group.webletName}</h3>
            {group.role && (
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                {group.role}
              </Badge>
            )}
            {group.status === "running" && (
              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Step {group.stepNumber}
            {timestamp && <> &middot; {new Date(timestamp).toLocaleTimeString()}</>}
            {" "}&middot; {inputLabel}
          </p>
        </div>

        {/* Running indicator */}
        {group.status === "running" && !hasOutput && (
          <p className="text-muted-foreground mt-3 text-sm">
            Agent is working on this step...
          </p>
        )}

        {/* Output toggle */}
        {hasOutput && (
          <Collapsible open={showOutput} onOpenChange={setShowOutput}>
            <CollapsibleTrigger asChild>
              <button className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showOutput ? (
                  <EyeOff className="w-3 h-3" />
                ) : (
                  <Eye className="w-3 h-3" />
                )}
                {showOutput ? "Hide output" : "Show output"}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border bg-card p-4 shadow-sm">
                <ChatMarkdown content={group.output!} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* HITL History — show all past reviews */}
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
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
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
        ? "border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30"
        : "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
    )}>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="w-3 h-3 text-muted-foreground" />
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5",
              isApproved
                ? "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                : "border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
            )}
          >
            {isApproved ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {isApproved ? "Approved" : "Rejected"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Step {stepNumber} review{revision ? ` #${revision}` : ""}
            {willRevise ? " — sent back for revision" : " completed"}
          </span>
        </div>
        {feedback && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
            <p className="italic">&ldquo;{feedback}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}
