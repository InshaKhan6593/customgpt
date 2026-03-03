"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useOrchestrationProgress } from "@/hooks/use-orchestration-progress";
import { AgentTimeline } from "@/components/flows/run/agent-timeline";
import { OutOfCreditsModal } from "@/components/monetization/out-of-credits-modal";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

export default function FlowExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id: flowId } = use(params);

  const [flow, setFlow] = useState<any>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Realtime events
  const { events, isConnected } = useOrchestrationProgress(sessionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasStartedRef = useRef(false);

  // Load flow info and auto-start execution
  useEffect(() => {
    const loadAndRun = async () => {
      try {
        const res = await fetch(`/api/flows/${flowId}`);
        const data = await res.json();
        if (res.ok) {
          setFlow(data);
        } else {
          setFlowError(data.error || "Failed to load flow");
        }
      } catch (err) {
        console.error(err);
        setFlowError("Could not connect to the server");
      }
    };
    loadAndRun();
  }, [flowId]);

  // Auto-start the flow once it's loaded
  useEffect(() => {
    if (!flow || hasStartedRef.current) return;
    hasStartedRef.current = true;

    // If no default prompt is configured, show error
    if (!flow.defaultPrompt?.trim()) {
      setFlowError("No default prompt configured. Go to the flow builder and add a default prompt before running.");
      return;
    }

    const autoStart = async () => {
      const prompt = flow.defaultPrompt;
      setIsRunning(true);
      setIsFinished(false);

      try {
        const res = await fetch(`/api/flows/${flowId}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initialInput: prompt })
        });
        const data = await res.json();

        if (res.ok) {
          setSessionId(data.sessionId);
          toast({ title: "Flow Started", description: "Execution is running in the background." });
        } else if (res.status === 402) {
          setShowUpgradeModal(true);
          setIsRunning(false);
        } else {
          toast({ title: "Failed to start", description: data.error || "An error occurred", variant: "destructive" });
          setIsRunning(false);
        }
      } catch (err) {
        toast({ title: "Network error", variant: "destructive" });
        setIsRunning(false);
      }
    };

    autoStart();
  }, [flow, flowId, toast]);

  // Track the number of step groups to only auto-scroll on new steps
  const prevStepCountRef = useRef(0);

  useEffect(() => {
    // Check if flow finished
    if (events.some(e => e.type === "completed" || e.type === "failed")) {
      setIsRunning(false);
      setIsFinished(true);
    }

    // Auto-scroll on new steps, tool calls, agent calls, or flow completion
    const stepCount = events.filter(e => e.type === "step_started" || e.type === "agent_called").length;
    const toolCallCount = events.filter(e => e.type === "tool_call").length;
    const hasFinished = events.some(e => e.type === "completed" || e.type === "failed");
    const scrollTrigger = stepCount + toolCallCount;

    if (scrollRef.current && (scrollTrigger > prevStepCountRef.current || hasFinished)) {
      prevStepCountRef.current = scrollTrigger;
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [events]);

  const handleHitlResponse = async (action: "approve" | "reject", feedback?: string) => {
    try {
      const res = await fetch(`/api/flows/run/${sessionId}/hitl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feedback })
      });
      if (res.ok) {
        toast({ title: "Response sent", description: `You ${action}d the step.` });
      }
    } catch (err) {
      toast({ title: "Failed to send response", variant: "destructive" });
    }
  };

  if (flowError) {
    return (
      <div className="flex flex-col min-h-svh bg-background">
        <NavHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <p className="text-sm font-medium text-destructive">{flowError}</p>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => router.push("/flows")} className="text-xs gap-1.5">
              <ArrowLeft className="size-3.5" />
              Back to Flows
            </Button>
            {flow && (
              <Button variant="secondary" size="sm" onClick={() => router.push(`/flows/builder/${flow.id}`)} className="text-xs">
                Open Builder
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!flow || !sessionId) {
    return (
      <div className="flex flex-col min-h-svh bg-background">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center">
          {!showUpgradeModal && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
        </div>
        <OutOfCreditsModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          onDecline={() => router.push("/flows")}
        />
      </div>
    );
  }

  // Calculate progress
  const isHybrid = flow.mode === "HYBRID";
  const completedSteps = new Set(events.filter(e => e.type === "step_completed").map(e => e.data.stepNumber)).size;
  const agentCallCount = events.filter(e => e.type === "agent_called").length;
  const agentDoneCount = events.filter(e => e.type === "agent_completed").length;

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <NavHeader />

      {/* Top Bar */}
      <div className="border-b bg-card py-3 px-6 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push(`/flows/builder/${flow.id}`)}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-base font-semibold text-foreground">{flow.name}</h1>
            <p className="text-sm text-muted-foreground">Execution Monitor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className={`size-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <main className="flex-1 flex max-w-4xl w-full mx-auto p-4 md:p-8 flex-col">
        <div className="flex flex-col h-full mt-4 space-y-6">

          {/* Progress Header */}
          <div className="rounded-lg border bg-card px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isFinished ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Loader2 className="size-5 text-muted-foreground animate-spin" />
                )}
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {isFinished ? "Workflow Complete" : "Executing Workflow"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isHybrid
                      ? agentCallCount === 0
                        ? (isFinished ? "Orchestrator completed the task" : "Orchestrator is actively running...")
                        : `${agentDoneCount} of ${agentCallCount} sub-agent call${agentCallCount !== 1 ? "s" : ""} completed`
                      : `${completedSteps} of ${flow.steps.length} step${flow.steps.length !== 1 ? "s" : ""} completed`
                    }
                  </p>
                </div>
              </div>

              {/* Step dots (sequential) / Pulse indicator (hybrid) */}
              {isHybrid ? (
                !isFinished && (
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-foreground animate-pulse" />
                    <span className="text-xs text-muted-foreground">Coordinator active</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: flow.steps.length }).map((_, i) => {
                    const done = i < completedSteps;
                    const active = i === completedSteps && !isFinished;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "size-2 rounded-full transition-all duration-300",
                          done && "bg-emerald-500",
                          active && "bg-foreground animate-pulse",
                          !done && !active && "bg-muted-foreground/25"
                        )}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Agent Timeline */}
          <div className="flex-1 overflow-y-auto pt-2 pb-8" ref={scrollRef}>
            <AgentTimeline
              events={events}
              totalSteps={flow.steps.length}
              onHitlRespond={handleHitlResponse}
            />
          </div>
        </div>

        <OutOfCreditsModal
          open={showUpgradeModal}
          onOpenChange={setShowUpgradeModal}
          onDecline={() => router.push("/flows")}
        />
      </main>
    </div>
  );
}
