"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Play, Save, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { use } from "react";
import {
  FlowCanvas,
  deserializeFlow,
  serializeFlow,
} from "@/components/flows/canvas/flow-canvas";
import type { FlowNode, FlowEdge, WebletItem, NodeExecutionState } from "@/components/flows/canvas/types";
import { useOrchestrationProgress } from "@/hooks/use-orchestration-progress";
import { OutOfCreditsModal } from "@/components/monetization/out-of-credits-modal";
import { Loader2, Square, CheckCircle2 } from "lucide-react";

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = use(params);

  const [flow, setFlow] = useState<any>(null);
  const [weblets, setWeblets] = useState<WebletItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialNodes, setInitialNodes] = useState<FlowNode[]>([]);
  const [initialEdges, setInitialEdges] = useState<FlowEdge[]>([]);
  const [canvasReady, setCanvasReady] = useState(false);

  // Execution state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { events, isConnected } = useOrchestrationProgress(sessionId);
  const [isRunning, setIsRunning] = useState(false);

  const isFinished = events.some(e => e.type === "completed" || e.type === "failed");

  // Ref to hold latest canvas data for save-from-toolbar
  const latestCanvasData = useRef<{ nodes: FlowNode[]; edges: FlowEdge[]; prompt: string } | null>(null);
  // Track whether canvas has unsaved changes — avoids redundant saves on Execute
  const isDirty = useRef(false);

  // Compute execution states for the canvas
  const executionStates = useMemo(() => {
    const states: Record<string, NodeExecutionState> = {};
    for (const e of events) {
      if (!e.data?.nodeId) continue;
      const id = e.data.nodeId;

      if (!states[id]) {
        states[id] = { status: "pending", toolCalls: [] };
      }

      switch (e.type) {
        case "node_started":
          states[id].status = "running";
          states[id].toolCalls = [];
          break;
        case "tool_call":
          states[id].status = "running";
          states[id].activeTool = {
            toolName: e.data.toolName,
            args: e.data.args,
          };
          if (!states[id].toolCalls) states[id].toolCalls = [];
          states[id].toolCalls!.push({
            toolName: e.data.toolName,
            args: e.data.args || {},
            result: e.data.result ?? null,
            state: "completed",
          });
          break;
        case "node_completed":
          states[id].status = "completed";
          states[id].activeTool = undefined;
          states[id].output = e.data.output || undefined;
          break;
        case "step_failed":
          states[id].status = "failed";
          states[id].activeTool = undefined;
          break;
      }
    }
    return states;
  }, [events]);

  // Handle auto-select of the last active node when finished
  useEffect(() => {
    if (isFinished && isRunning) {
      setIsRunning(false);
      // Let the canvas pick up the final node selection via a custom event later
      window.dispatchEvent(new CustomEvent("flowExecutionCompleted", { detail: { events } }));
    }
  }, [isFinished, isRunning, events]);

  // Load flow and available weblets
  useEffect(() => {
    const loadData = async () => {
      try {
        const [flowRes, webletsRes] = await Promise.all([
          fetch(`/api/flows/${id}`),
          fetch(`/api/marketplace/weblets?limit=50&all=true`),
        ]);

        const flowData = await flowRes.json();

        if (flowRes.ok) {
          setFlow(flowData);

          let webletsList: WebletItem[] = [];
          if (webletsRes.ok) {
            const webletsData = await webletsRes.json();
            const raw: any[] = Array.isArray(webletsData.data) ? webletsData.data : [];
            // Merge mcpServers + capabilities → tools
            webletsList = raw.map((w: any) => {
              // MCP tools: id, label, iconUrl
              const mcpTools = Array.isArray(w.mcpServers)
                ? w.mcpServers.map((s: any) => ({ id: s.id, label: s.label, iconUrl: s.iconUrl ?? null }))
                : [];

              let capTools: any[] = [];
              if (Array.isArray(w.capabilities)) {
                capTools = w.capabilities.map((c: any, i: number) => ({
                  id: `cap-${w.id}-${i}`,
                  label: typeof c === "string" ? c : (c.name || c.label || "Capability"),
                  iconUrl: c.iconUrl ?? null,
                }));
              } else if (w.capabilities && typeof w.capabilities === "object") {
                const capMap: Record<string, string> = {
                  webSearch: "Web Search",
                  codeInterpreter: "Code Interpreter",
                  imageGen: "Image Generation",
                  fileSearch: "File Search"
                };
                Object.entries(w.capabilities).forEach(([key, val]) => {
                  if (val === true && capMap[key]) {
                    capTools.push({
                      id: `cap-${w.id}-${key}`,
                      label: capMap[key],
                      iconUrl: null
                    });
                  }
                });
              }

              return { ...w, tools: [...capTools, ...mcpTools] };
            });
            setWeblets(webletsList);
          }

          // Build weblet lookup map
          const webletMap = new Map<string, WebletItem>();
          for (const w of webletsList) {
            webletMap.set(w.id, w);
          }

          // Deserialize flow steps → canvas nodes/edges
          const steps = Array.isArray(flowData.steps) ? flowData.steps : [];
          const canvasLayout = flowData.canvasState || null;
          const { nodes, edges } = deserializeFlow(
            steps,
            flowData.defaultPrompt || "",
            webletMap,
            canvasLayout
          );

          setInitialNodes(nodes);
          setInitialEdges(edges);
          setCanvasReady(true);
        } else {
          toast({ title: "Error", description: flowData.error || "Failed to load flow", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Error", description: "Network error loading builder", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, toast]);

  // ── Save flow ──
  const saveFlow = useCallback(
    async (data: { nodes: FlowNode[]; edges: FlowEdge[]; prompt: string }) => {
      setSaving(true);
      try {
        const { steps, prompt, canvasState } = serializeFlow(data.nodes, data.edges);

        if (steps.length === 0) {
          toast({ title: "No agents", description: "Add at least one agent to the canvas and connect it.", variant: "destructive" });
          setSaving(false);
          return;
        }

        const hasEmptyWeblet = steps.some((s) => !s.webletId);
        if (hasEmptyWeblet) {
          toast({ title: "Missing agent", description: "All agent nodes must have a weblet selected.", variant: "destructive" });
          setSaving(false);
          return;
        }

        const res = await fetch(`/api/flows/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: flow.name,
            mode: "SEQUENTIAL",
            defaultPrompt: prompt || flow.defaultPrompt || null,
            steps,
            canvasState,
          }),
        });

        if (res.ok) {
          setFlow((prev: any) => ({ ...prev, defaultPrompt: prompt || prev.defaultPrompt }));
          isDirty.current = false;
          toast({ title: "Saved", description: "Workflow saved successfully." });
          return true;
        } else {
          toast({ title: "Error", description: "Failed to save workflow.", variant: "destructive" });
          return false;
        }
      } catch (err) {
        toast({ title: "Error", description: "Network error saving workflow.", variant: "destructive" });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, flow, toast]
  );

  // ── Run flow directly on canvas ──
  const runFlow = async (data?: { nodes: FlowNode[]; edges: FlowEdge[]; prompt: string }) => {
    const promptNode = (data?.nodes || latestCanvasData.current?.nodes)?.find((n) => n.type === "prompt");
    const promptText = promptNode?.data?.prompt || flow.defaultPrompt;
    if (!promptText?.trim()) {
      toast({ title: "No prompt", description: "Set a default prompt first (click the Input Prompt node).", variant: "destructive" });
      return;
    }

    setIsRunning(true);

    // Generate sessionId client-side so we can start subscribing to the
    // realtime channel immediately — before save + execute round-trips finish.
    const earlySessionId = crypto.randomUUID();
    setSessionId(earlySessionId);

    const savedData = data || latestCanvasData.current || { nodes: initialNodes, edges: initialEdges, prompt: flow.defaultPrompt };

    // Only save if the canvas has unsaved changes — skip the round-trip otherwise.
    if (isDirty.current) {
      const saved = await saveFlow(savedData);
      if (!saved) {
        setIsRunning(false);
        setSessionId(null);
        return;
      }
    }

    try {
      const res = await fetch(`/api/flows/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialInput: promptText, sessionId: earlySessionId }),
      });
      const dataRes = await res.json();

      if (!res.ok) {
        if (res.status === 402) {
          setShowUpgradeModal(true);
        } else {
          toast({ title: "Failed to start", description: dataRes.error || "Execution failed", variant: "destructive" });
        }
        setIsRunning(false);
        setSessionId(null);
        return;
      }

      toast({ title: "Running", description: "Workflow execution started." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to start flow execution", variant: "destructive" });
      setIsRunning(false);
      setSessionId(null);
    }
  };

  // ── Execute flow from canvas ──
  const saveAndExecute = useCallback(
    async (data: { nodes: FlowNode[]; edges: FlowEdge[]; prompt: string }) => {
      await runFlow(data);
    },
    [saveFlow, id]
  );

  // ── Callback from canvas whenever state changes ──
  const onCanvasChange = useCallback(
    (data: { nodes: FlowNode[]; edges: FlowEdge[]; prompt: string }) => {
      latestCanvasData.current = data;
      // Mark dirty only when not in read-only execution mode — execution state
      // syncs also trigger this callback and should not count as user edits.
      if (!sessionId) isDirty.current = true;
    },
    [sessionId]
  );

  // ── Save from top bar using latest canvas data ──
  const handleTopBarSave = useCallback(() => {
    if (latestCanvasData.current) {
      saveFlow(latestCanvasData.current);
    } else {
      toast({ title: "Nothing to save", description: "Make changes on the canvas first.", variant: "destructive" });
    }
  }, [saveFlow, toast]);

  // ── Auto-suggest team ──
  const autoSuggestTeam = async () => {
    const task = window.prompt("Describe the task you want the AI team to accomplish:");
    if (!task || !task.trim()) return;

    toast({ title: "Auto-Suggesting Team", description: "Asking AI to recommend the perfect team..." });
    try {
      const res = await fetch("/api/flows/auto-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Failed", description: data.error || "Could not get suggestion", variant: "destructive" });
        return;
      }

      // Build weblet map
      const webletMap = new Map<string, WebletItem>();
      for (const w of weblets) webletMap.set(w.id, w);

      const suggestedSteps = data.suggestedTeam.map((member: any, idx: number) => ({
        webletId: member.webletId,
        order: idx + 1,
        inputMapping: idx === 0 ? "original" : "previous",
        hitlGate: false,
        role: member.role || "",
        stepPrompt: "",
      }));

      const { nodes, edges } = deserializeFlow(
        suggestedSteps,
        flow.defaultPrompt || "",
        webletMap,
        null
      );

      setInitialNodes(nodes);
      setInitialEdges(edges);
      setCanvasReady(false);
      setTimeout(() => setCanvasReady(true), 50);

      toast({
        title: "Team Formed!",
        description: `AI suggested ${suggestedSteps.length} agent(s). ${data.reasoning || ""}`,
      });
    } catch (err) {
      toast({ title: "Failed", description: "AI could not suggest a team.", variant: "destructive" });
    }
  };



  const stopFlow = () => {
    setIsRunning(false);
    setSessionId(null);
    toast({ title: "Stopped", description: "Cleared execution state." });
  };

  if (loading || !flow) {
    return (
      <div className="flex flex-col h-svh bg-background">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-svh bg-background overflow-hidden">
      <NavHeader />

      {/* Top bar */}
      <div className="border-b bg-card py-2.5 px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3 flex-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => router.push("/flows")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={flow.name}
            onChange={(e) => setFlow({ ...flow, name: e.target.value })}
            className="font-semibold text-sm border-transparent hover:border-border focus-visible:bg-background max-w-xs h-8"
          />
        </div>
        <div className="flex items-center gap-2">
          {isRunning || sessionId ? (
            <div className="flex items-center gap-3 mr-2 px-3 py-1 bg-muted/40 rounded-sm border">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground mr-1">
                {isConnected ? (
                  <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500" /> Connected</span>
                ) : (
                  <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-red-500" /> Disconnected</span>
                )}
              </span>
              {(isRunning && !isFinished) ? (
                <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                  <Loader2 className="size-3 animate-spin" />
                  Executing...
                </div>
              ) : isFinished ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="size-3" />
                  Completed
                </div>
              ) : null}
              <Button variant="ghost" size="icon" onClick={stopFlow} className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1" title="Clear Execution">
                <Square className="size-3 fill-current" />
              </Button>
            </div>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={autoSuggestTeam}>
                <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                Auto-Suggest
              </Button>
              <Button variant="outline" size="sm" disabled={saving} onClick={handleTopBarSave}>
                <Save className="w-3.5 h-3.5 mr-1.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Canvas area — fills remaining space */}
      <div className="flex-1 min-h-0">
        {canvasReady ? (
          <FlowCanvas
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            weblets={weblets}
            defaultPrompt={flow.defaultPrompt || ""}
            onSave={saveAndExecute}
            saving={saving}
            onChange={onCanvasChange}
            readOnly={!!sessionId || isRunning}
            executionStates={executionStates}
            isFinished={isFinished}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading canvas...
          </div>
        )}
      </div>

      <OutOfCreditsModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        onDecline={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
