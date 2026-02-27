"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useOrchestrationProgress } from "@/hooks/use-orchestration-progress";
import { Textarea } from "@/components/ui/textarea";
import { AgentTimeline } from "@/components/flows/run/agent-timeline";
import { ArrowLeft, Loader2, CheckCircle2, Circle, Sparkles, Send } from "lucide-react";

export default function FlowExecutionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id: flowId } = use(params);

  const [flow, setFlow] = useState<any>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [initialInput, setInitialInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Realtime events
  const { events, isConnected } = useOrchestrationProgress(sessionId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load flow info
  useEffect(() => {
    const loadData = async () => {
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
    loadData();
  }, [flowId]);

  // Track the number of step groups to only auto-scroll on new steps
  const prevStepCountRef = useRef(0);

  useEffect(() => {
    // Check if flow finished
    if (events.some(e => e.type === "completed" || e.type === "failed")) {
      setIsRunning(false);
      setIsFinished(true);
    }

    // Only auto-scroll when a new step starts or flow completes — not on every event
    const stepCount = events.filter(e => e.type === "step_started").length;
    const hasFinished = events.some(e => e.type === "completed" || e.type === "failed");

    if (scrollRef.current && (stepCount > prevStepCountRef.current || hasFinished)) {
      prevStepCountRef.current = stepCount;
      // Use requestAnimationFrame to ensure DOM has updated
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

  const startFlow = async () => {
    if (!initialInput.trim()) {
      toast({ title: "Input required", description: "Please enter a starting prompt.", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    setIsFinished(false);

    try {
      const res = await fetch(`/api/flows/${flowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialInput })
      });
      const data = await res.json();

      if (res.ok) {
        setSessionId(data.sessionId);
        toast({ title: "Flow Started", description: "Execution is running in the background." });
      } else {
        toast({ title: "Failed to start", description: data.error, variant: "destructive" });
        setIsRunning(false);
      }
    } catch (err) {
      toast({ title: "Network error", variant: "destructive" });
      setIsRunning(false);
    }
  };

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
          <p className="text-destructive font-medium">{flowError}</p>
          <Button variant="outline" onClick={() => router.push("/flows")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Flows
          </Button>
        </div>
      </div>
    );
  }

  if (!flow) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate progress %
  const currentStepEvent = events.slice().reverse().find(e => e.type === "step_started" || e.type === "step_completed");
  const stepNum = currentStepEvent ? currentStepEvent.data.stepNumber : 0;
  const completedSteps = events.filter(e => e.type === "step_completed").length;
  const progressPct = flow.steps.length > 0 ? (completedSteps / flow.steps.length) * 100 : 0;

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <NavHeader />

      {/* Top Bar Navigation */}
      <div className="border-b bg-card py-4 px-6 sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/flows/builder/${flow.id}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-bold text-lg">{flow.name}</h1>
            <p className="text-xs text-muted-foreground">Execution Monitor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sessionId && (
            <span className="flex items-center text-xs text-muted-foreground">
              <Circle className={`w-2 h-2 mr-1.5 fill-current ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
              {isConnected ? 'Realtime Connected' : 'Disconnected'}
            </span>
          )}
        </div>
      </div>

      <main className="flex-1 flex max-w-4xl w-full mx-auto p-4 md:p-8 flex-col">

        {!sessionId ? (
          <Card className="max-w-lg mx-auto w-full mt-10 shadow-lg border-0 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center mb-3 ring-1 ring-blue-500/10">
                <Sparkles className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-2xl">Run this workflow</CardTitle>
              <CardDescription className="max-w-md mx-auto">
                This flow chains {flow.steps.length} agent{flow.steps.length !== 1 ? "s" : ""} together in sequence.
                Describe what you need and the agents will collaborate to produce the result.
              </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6 pb-6 space-y-4">
              <Textarea
                placeholder="Enter the initial prompt..."
                value={initialInput}
                onChange={(e) => setInitialInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startFlow(); }}
                className="w-full text-base resize-none bg-muted/50 focus-visible:bg-background"
                rows={3}
              />
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={startFlow}
                disabled={isRunning}
              >
                {isRunning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {isRunning ? "Starting..." : "Run Flow"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col h-full mt-4 space-y-4">

            {/* Progress Header */}
            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isFinished ? (
                    <div className="w-8 h-8 rounded-full bg-zinc-900/10 dark:bg-zinc-100/10 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-foreground" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-zinc-900/10 dark:bg-zinc-100/10 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {isFinished ? "Workflow Complete" : "Executing Workflow"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {completedSteps} of {flow.steps.length} step{flow.steps.length !== 1 ? "s" : ""} completed
                    </p>
                  </div>
                </div>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {Math.round(progressPct)}%
                </span>
              </div>
              <div className="px-4 pb-3">
                <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-zinc-600 to-zinc-800 dark:from-zinc-400 dark:to-zinc-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Agent Timeline */}
            <div className="flex-1 overflow-y-auto pt-4 pb-8" ref={scrollRef}>
              <AgentTimeline
                events={events}
                totalSteps={flow.steps.length}
                onHitlRespond={handleHitlResponse}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
