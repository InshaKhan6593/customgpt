"use client";

import { useCallback, useRef, useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type OnConnect,
  type NodeTypes,
  type EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { PromptNodeMemo } from "./prompt-node";
import { WebletNodeMemo } from "./weblet-node";
import { OrchestratorNodeMemo } from "./orchestrator-node";
import { InteractiveEdge } from "./interactive-edge";
import { WebletSidebar } from "./weblet-sidebar";
import { Plus, Play, Network, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NodeSettingsPanel } from "./node-settings-panel";
import { NodeOutputPanel } from "./node-output-panel";
import type {
  FlowNode,
  FlowEdge,
  FlowMode,
  WebletItem,
  WebletNodeData,
  PromptNodeData,
  FlowStepSerialized,
  CanvasState,
  NodeExecutionState,
} from "./types";

// ── Node type registry ──
const nodeTypes: NodeTypes = {
  prompt: PromptNodeMemo,
  weblet: WebletNodeMemo,
  orchestrator: OrchestratorNodeMemo,
} as unknown as NodeTypes;

// ── Edge type registry ──
const edgeTypes: EdgeTypes = {
  interactive: InteractiveEdge,
} as unknown as EdgeTypes;

// ── Default edge style ──
const defaultEdgeOptions = {
  type: "interactive",
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 6,
    height: 6,
    color: "#a1a1aa",
  },
};

const hybridEdgeOptions = {
  ...defaultEdgeOptions,
  markerEnd: { ...defaultEdgeOptions.markerEnd, color: "#f59e0b" },
};

/** Ensure all edges use the interactive type + correct marker */
function normalizeEdges(edges: FlowEdge[], mode?: FlowMode): FlowEdge[] {
  const opts = mode === "HYBRID" ? hybridEdgeOptions : defaultEdgeOptions;
  return edges.map((e) => ({
    ...e,
    type: "interactive",
    animated: true,
    markerEnd: opts.markerEnd,
  }));
}

const connectionLineStyle = {
  stroke: "#a1a1aa",
  strokeWidth: 1.5,
};

// ── Mode Selector Component ──
function ModeSelector({
  mode,
  onChange,
  disabled,
}: {
  mode: FlowMode;
  onChange: (m: FlowMode) => void;
  disabled?: boolean;
}) {
  const modes: { value: FlowMode; label: string; icon: React.ReactNode; title: string }[] = [
    {
      value: "PARALLEL",
      label: "DAG",
      icon: <Network className="size-3" />,
      title: "Free-form DAG — wire any topology: chains, fan-out, fan-in, branches. No restrictions.",
    },
    {
      value: "HYBRID",
      label: "Hybrid",
      icon: <Crown className="size-3" />,
      title: "One master orchestrator delegates tasks dynamically to sub-agents at runtime",
    },
  ];

  return (
    <div className="flex gap-0.5 p-0.5 bg-black/90 border border-zinc-800 rounded-sm shadow-xl backdrop-blur-sm">
      {modes.map((m) => (
        <button
          key={m.value}
          title={m.title}
          disabled={disabled}
          onClick={() => onChange(m.value)}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-[2px] transition-all
            ${mode === m.value
              ? m.value === "HYBRID"
                ? "bg-amber-950/80 text-amber-400 border border-amber-700/50"
                : "bg-zinc-900 text-zinc-100 border border-zinc-700"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 border border-transparent"}
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
        >
          {m.icon}
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ── Layout transform for mode switching ──
function transformCanvasForMode(
  nodes: FlowNode[],
  edges: FlowEdge[],
  targetMode: FlowMode,
  currentMasterWebletId: string | null
): { nodes: FlowNode[]; edges: FlowEdge[]; masterWebletId: string | null } {
  const promptNode = nodes.find((n) => n.type === "prompt");
  const webletNodes = nodes.filter((n) => n.type === "weblet" || n.type === "orchestrator");

  if (webletNodes.length === 0) {
    return { nodes, edges, masterWebletId: null };
  }

  if (targetMode === "PARALLEL" || targetMode === "SEQUENTIAL") {
    // Keep positions, just convert any orchestrator node back to weblet
    const newNodes = nodes.map((n) =>
      n.type === "orchestrator"
        ? ({ ...n, type: "weblet", data: { ...n.data, isOrchestrator: false } } as FlowNode)
        : n
    );
    return { nodes: newNodes, edges, masterWebletId: null };
  }

  if (targetMode === "HYBRID") {
    // Orchestrator in center, sub-agents radiate around it
    const masterWebletNode = currentMasterWebletId
      ? webletNodes.find((n) => n.data.webletId === currentMasterWebletId)
      : webletNodes[0];

    const masterNode = masterWebletNode || webletNodes[0];
    const masterId = masterNode.data.webletId as string;
    const subAgents = webletNodes.filter((n) => n.id !== masterNode.id);

    const centerX = 400;
    const centerY = 300;
    const radius = subAgents.length <= 2 ? 220 : subAgents.length <= 4 ? 260 : 320;

    const newNodes: FlowNode[] = [];
    const newEdges: FlowEdge[] = [];

    // Prompt node top-left
    if (promptNode) {
      newNodes.push({ ...promptNode, position: { x: centerX - 80, y: centerY - 240 } });
    }

    // Orchestrator center
    newNodes.push({
      ...masterNode,
      type: "orchestrator",
      position: { x: centerX - 95, y: centerY - 60 },
      data: { ...masterNode.data, isOrchestrator: true },
    } as FlowNode);

    // Sub-agents in a radial layout
    subAgents.forEach((n, i) => {
      const angle = (i / subAgents.length) * 2 * Math.PI - Math.PI / 2;
      newNodes.push({
        ...n,
        type: "weblet",
        position: {
          x: centerX + radius * Math.cos(angle) - 85,
          y: centerY + radius * Math.sin(angle) + 80,
        },
        data: { ...n.data, isOrchestrator: false },
      } as FlowNode);

      // Edge: sub-agent → orchestrator (sub-agents feed INTO orchestrator)
      newEdges.push({
        id: `e-${n.id}-${masterNode.id}`,
        source: n.id,
        target: masterNode.id,
        ...hybridEdgeOptions,
      });
    });

    // Prompt → orchestrator
    if (promptNode) {
      newEdges.push({
        id: `e-prompt-${masterNode.id}`,
        source: promptNode.id,
        target: masterNode.id,
        ...hybridEdgeOptions,
      });
    }

    return { nodes: newNodes, edges: newEdges, masterWebletId: masterId };
  }

  return { nodes, edges, masterWebletId: currentMasterWebletId };
}

// ── Props ──
interface FlowCanvasProps {
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  weblets: WebletItem[];
  defaultPrompt: string;
  mode?: FlowMode;
  masterWebletId?: string | null;
  onSave?: (data: {
    nodes: FlowNode[];
    edges: FlowEdge[];
    prompt: string;
    mode: FlowMode;
    masterWebletId: string | null;
  }) => void;
  saving?: boolean;
  onChange?: (data: {
    nodes: FlowNode[];
    edges: FlowEdge[];
    prompt: string;
    mode: FlowMode;
    masterWebletId: string | null;
  }) => void;
  readOnly?: boolean;
  executionStates?: Record<string, NodeExecutionState>;
  isFinished?: boolean;
}

function FlowCanvasInner({
  initialNodes,
  initialEdges,
  weblets,
  defaultPrompt,
  mode: propMode,
  masterWebletId: propMasterWebletId,
  onSave,
  saving,
  onChange,
  readOnly = false,
  executionStates,
  isFinished = false,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  // Legacy SEQUENTIAL flows load as PARALLEL (DAG) — sequential is just a linear DAG topology
  const [flowMode, setFlowMode] = useState<FlowMode>(
    propMode === "SEQUENTIAL" ? "PARALLEL" : (propMode ?? "PARALLEL")
  );
  const [masterWebletId, setMasterWebletId] = useState<string | null>(propMasterWebletId ?? null);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(normalizeEdges(initialEdges, propMode));

  // Stable ref to current nodes — used inside setEdges callback to avoid
  // adding `nodes` to the execution states effect dependency array (which causes infinite loops)
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; });
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [outputPanelNode, setOutputPanelNode] = useState<FlowNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Right-click context menu for "Set as Orchestrator" in HYBRID mode
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string; webletId: string } | null>(null);

  useEffect(() => {
    const handleOpenSidebar = () => setIsSidebarOpen(true);
    window.addEventListener("openWebletSidebar", handleOpenSidebar);
    return () => window.removeEventListener("openWebletSidebar", handleOpenSidebar);
  }, []);

  useEffect(() => {
    const handleOpenNodeOutput = (e: CustomEvent) => {
      const nodeId = e.detail?.nodeId;
      if (nodeId) {
        const targetNode = nodes.find((n) => n.id === nodeId);
        if (targetNode) { setOutputPanelNode(targetNode); setSelectedNode(null); }
      }
    };
    window.addEventListener("openNodeOutput", handleOpenNodeOutput as EventListener);
    return () => window.removeEventListener("openNodeOutput", handleOpenNodeOutput as EventListener);
  }, [nodes]);

  useEffect(() => {
    const handleSelectNode = (e: CustomEvent) => {
      const nodeId = e.detail?.nodeId;
      if (nodeId) {
        const targetNode = nodes.find((n) => n.id === nodeId);
        if (targetNode) { setSelectedNode(targetNode); setOutputPanelNode(null); setIsSidebarOpen(false); }
      }
    };
    window.addEventListener("selectNode", handleSelectNode as EventListener);
    return () => window.removeEventListener("selectNode", handleSelectNode as EventListener);
  }, [nodes]);

  useEffect(() => {
    const handleExecComplete = (e: CustomEvent) => {
      const events = e.detail?.events || [];
      const lastEvent = [...events].reverse().find((ev: any) => ev.type === "node_completed" || ev.type === "step_failed");
      if (lastEvent?.data?.nodeId) {
        const targetNode = nodes.find((n) => n.id === lastEvent.data.nodeId);
        if (targetNode) setOutputPanelNode(targetNode);
      }
    };
    window.addEventListener("flowExecutionCompleted", handleExecComplete as EventListener);
    return () => window.removeEventListener("flowExecutionCompleted", handleExecComplete as EventListener);
  }, [nodes]);

  useEffect(() => {
    if (!readOnly) { setOutputPanelNode(null); }
    else { setSelectedNode(null); }
  }, [readOnly]);

  // ── Sync execution states + FIXED animation bug ──
  // NOTE: `nodes` is intentionally NOT in the dep array — we use `nodesRef` instead.
  // Including `nodes` causes an infinite loop: setEdges → ReactFlow internal update
  // → nodes changes → effect re-fires → setEdges again → ...
  useEffect(() => {
    if (!executionStates) return;

    setNodes((nds) =>
      nds.map((n) => {
        const state = executionStates[n.id];
        if (!state) return n;
        return { ...n, data: { ...n.data, executionState: state } } as FlowNode;
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        if (isFinished) {
          return { ...e, className: "", animated: true };
        }

        const sourceState = executionStates[e.source];
        const targetState = executionStates[e.target];
        // Use ref to read current nodes without adding to deps
        const sourceNode = nodesRef.current.find((n) => n.id === e.source);
        const isFromPrompt = sourceNode?.type === "prompt";

        let className = "";

        // Glow the edge whose TARGET is running — shows data arriving at the active node.
        // e.g. prompt→Node1 glows while Node1 runs; Node1→Node2 glows while Node2 runs.
        // Do NOT glow the outgoing edge of a running node (data hasn't left yet).
        if (targetState?.status === "running") {
          className = isFromPrompt ? "input-glowing-edge" : "glowing-edge";
        } else if (sourceState?.status === "completed" && (!targetState || targetState.status === "pending")) {
          // Upstream done, downstream hasn't started — dim waiting pulse
          className = "waiting-edge";
        } else if (sourceState?.status === "completed" && targetState?.status === "completed") {
          className = "completed-edge";
        }

        return { ...e, className, animated: true };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [executionStates, isFinished, setNodes, setEdges]);

  // ── Mode switch ──
  // Read nodes/edges directly (they're stable refs from useNodesState/useEdgesState)
  // then call all setters independently — never nest setters inside each other.
  const handleModeChange = useCallback(
    (newMode: FlowMode) => {
      const { nodes: newNodes, edges: newEdges, masterWebletId: newMasterId } =
        transformCanvasForMode(nodes as FlowNode[], edges as FlowEdge[], newMode, masterWebletId);
      setFlowMode(newMode);
      setMasterWebletId(newMasterId);
      setNodes(newNodes as any);
      setEdges(normalizeEdges(newEdges, newMode) as any);
    },
    [nodes, edges, masterWebletId, setNodes, setEdges]
  );

  // ── Set orchestrator in HYBRID mode ──
  const setAsOrchestrator = useCallback(
    (nodeId: string, webletId: string) => {
      const currentNodes = nodes as FlowNode[];
      const newNodes = currentNodes.map((n) => {
        if (n.id === nodeId) return { ...n, type: "orchestrator", data: { ...n.data, isOrchestrator: true } } as FlowNode;
        if (n.type === "orchestrator") return { ...n, type: "weblet", data: { ...n.data, isOrchestrator: false } } as FlowNode;
        return n;
      });
      const promptEdges = (edges as FlowEdge[]).filter((e) => {
        const src = currentNodes.find((n) => n.id === e.source);
        return src?.type === "prompt";
      });
      const subAgentEdges = currentNodes
        .filter((n) => n.id !== nodeId && (n.type === "weblet" || n.type === "orchestrator"))
        .map((n) => ({
          id: `e-${n.id}-${nodeId}`,
          source: n.id,
          target: nodeId,
          ...hybridEdgeOptions,
        }));
      setMasterWebletId(webletId);
      setNodes(newNodes as any);
      setEdges(normalizeEdges([...promptEdges, ...subAgentEdges], "HYBRID") as any);
      setContextMenu(null);
    },
    [nodes, edges, setNodes, setEdges]
  );

  // ── Connect nodes ──
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      const opts = flowMode === "HYBRID" ? hybridEdgeOptions : defaultEdgeOptions;
      setEdges((eds) => addEdge({ ...params, ...opts }, eds));
    },
    [setEdges, flowMode]
  );

  // ── Node click ──
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      setContextMenu(null);
      if (readOnly) {
        setOutputPanelNode(node);
        setSelectedNode(null);
      } else {
        setSelectedNode(node);
        setOutputPanelNode(null);
      }
    },
    [readOnly]
  );

  // ── Right-click: show "Set as Orchestrator" in HYBRID mode ──
  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: FlowNode) => {
      if (readOnly || flowMode !== "HYBRID" || node.type === "prompt" || node.type === "orchestrator") return;
      e.preventDefault();
      const data = node.data as WebletNodeData;
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, webletId: data.webletId });
    },
    [readOnly, flowMode]
  );

  // ── Pane click ──
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsSidebarOpen(false);
    setOutputPanelNode(null);
    setContextMenu(null);
  }, []);

  // ── Update node data ──
  const updateNodeData = useCallback(
    (nodeId: string, update: Partial<WebletNodeData | PromptNodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          return { ...n, data: { ...n.data, ...update } } as FlowNode;
        }) as FlowNode[]
      );
      setSelectedNode((prev) => {
        if (prev && prev.id === nodeId) {
          return { ...prev, data: { ...prev.data, ...update } } as FlowNode;
        }
        return prev;
      });
    },
    [setNodes]
  );

  // ── Delete node ──
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
    },
    [setNodes, setEdges]
  );

  // ── Build a new weblet node, wiring it appropriately per mode ──
  const addWebletNode = useCallback(
    (weblet: WebletItem, position: { x: number; y: number }) => {
      const nodeId = `weblet-${Date.now()}`;

      if (flowMode === "HYBRID") {
        // Check if we already have an orchestrator
        const orchestratorNode = nodes.find((n) => n.type === "orchestrator");

        if (!orchestratorNode) {
          // First weblet in HYBRID becomes the orchestrator
          const newNode: FlowNode = {
            id: nodeId,
            type: "orchestrator",
            position,
            data: {
              label: weblet.name,
              webletId: weblet.id,
              webletName: weblet.name,
              iconUrl: weblet.iconUrl,
              category: weblet.category,
              role: "",
              stepPrompt: "",
              hitlGate: false,
              description: weblet.description || "",
              tools: weblet.tools || [],
              isOrchestrator: true,
            },
          };
          setNodes((nds) => [...nds, newNode]);
          setMasterWebletId(weblet.id);

          // Connect prompt → orchestrator
          const promptNode = nodes.find((n) => n.type === "prompt");
          if (promptNode) {
            setEdges((eds) => [
              ...eds,
              {
                id: `e-${promptNode.id}-${nodeId}`,
                source: promptNode.id,
                target: nodeId,
                ...hybridEdgeOptions,
              },
            ]);
          }
        } else {
          // Subsequent weblets become sub-agents: position radiating from orchestrator
          const subAgentCount = nodes.filter((n) => n.type === "weblet").length;
          const angle = (subAgentCount / Math.max(subAgentCount + 1, 3)) * 2 * Math.PI - Math.PI / 2;
          const radius = 280;
          const orchPos = orchestratorNode.position;
          const subPos = {
            x: orchPos.x + radius * Math.cos(angle),
            y: orchPos.y + radius * Math.sin(angle) + 80,
          };

          const newNode: FlowNode = {
            id: nodeId,
            type: "weblet",
            position: subPos,
            data: {
              label: weblet.name,
              webletId: weblet.id,
              webletName: weblet.name,
              iconUrl: weblet.iconUrl,
              category: weblet.category,
              role: "",
              stepPrompt: "",
              hitlGate: false,
              description: weblet.description || "",
              tools: weblet.tools || [],
              isOrchestrator: false,
            },
          };
          setNodes((nds) => [...nds, newNode]);
          // Sub-agent → orchestrator edge
          setEdges((eds) => [
            ...eds,
            {
              id: `e-${nodeId}-${orchestratorNode.id}`,
              source: nodeId,
              target: orchestratorNode.id,
              ...hybridEdgeOptions,
            },
          ]);
        }
      } else {
        // DAG mode — plain weblet node, user wires any topology they want
        const newNode: FlowNode = {
          id: nodeId,
          type: "weblet",
          position,
          data: {
            label: weblet.name,
            webletId: weblet.id,
            webletName: weblet.name,
            iconUrl: weblet.iconUrl,
            category: weblet.category,
            role: "",
            stepPrompt: "",
            hitlGate: false,
            description: weblet.description || "",
            tools: weblet.tools || [],
          },
        };
        setNodes((nds) => [...nds, newNode]);
      }
    },
    [flowMode, nodes, setNodes, setEdges]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/weblet");
      if (!data) return;
      const weblet: WebletItem = JSON.parse(data);
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addWebletNode(weblet, position);
    },
    [screenToFlowPosition, addWebletNode]
  );

  const onWebletClick = useCallback(
    (weblet: WebletItem) => {
      const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      addWebletNode(weblet, position);
    },
    [screenToFlowPosition, addWebletNode]
  );

  // ── Current prompt ──
  const currentPrompt = useMemo(() => {
    const promptNode = nodes.find((n) => n.type === "prompt");
    return (promptNode?.data as PromptNodeData)?.prompt || "";
  }, [nodes]);

  // ── Report state changes to parent ──
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.({
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
      prompt: currentPrompt,
      mode: flowMode,
      masterWebletId,
    });
  }, [nodes, edges, currentPrompt, flowMode, masterWebletId]);

  // ── Save handler ──
  const handleSave = useCallback(() => {
    onSave?.({
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
      prompt: currentPrompt,
      mode: flowMode,
      masterWebletId,
    });
  }, [nodes, edges, currentPrompt, onSave, flowMode, masterWebletId]);

  return (
    <div className="flex h-full relative overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Canvas */}
      <div className="flex-1 relative h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={readOnly ? undefined : onConnect}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onPaneClick={onPaneClick}
          onDragOver={readOnly ? undefined : onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          minZoom={0.2}
          maxZoom={1.5}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={["Backspace", "Delete"]}
          connectionLineStyle={connectionLineStyle}
          connectionLineType={ConnectionLineType.SmoothStep}
          className="!bg-zinc-50 dark:!bg-zinc-950"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="currentColor" className="text-zinc-300 dark:text-zinc-800/80" />
          <Controls className="!bg-white dark:!bg-zinc-900 !border-zinc-200 dark:!border-zinc-800 !shadow-sm !rounded-lg overflow-hidden [&>button]:!bg-white dark:[&>button]:!bg-zinc-900 [&>button]:!border-zinc-200 dark:[&>button]:!border-zinc-800 [&>button]:!text-zinc-600 dark:[&>button]:!text-zinc-400 hover:[&>button]:!bg-zinc-100 dark:hover:[&>button]:!bg-zinc-800" />

          {/* Mode selector — centered top overlay */}
          {!readOnly && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
              <ModeSelector mode={flowMode} onChange={handleModeChange} />
            </div>
          )}

          {/* HYBRID mode hint */}
          {!readOnly && flowMode === "HYBRID" && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 mt-1">
              <span className="text-[9px] text-amber-600/70 font-medium">
                First agent added becomes the orchestrator · right-click any agent to promote
              </span>
            </div>
          )}

          {/* Custom SVG Markers */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0 }}>
            <defs>
              <marker id="arrow-amber" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
              </marker>
              <marker id="arrow-zinc-200" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L6,3 L0,6 Z" fill="#e4e4e7" />
              </marker>
              <marker id="arrow-zinc-400" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L6,3 L0,6 Z" fill="#a1a1aa" />
              </marker>
            </defs>
          </svg>
        </ReactFlow>

        {/* Right-click context menu */}
        {contextMenu && (
          <div
            className="fixed z-[9999] bg-black border border-zinc-800 rounded-sm shadow-2xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-amber-400 hover:bg-amber-950/60 transition-colors"
              onClick={() => setAsOrchestrator(contextMenu.nodeId, contextMenu.webletId)}
            >
              <Crown className="size-3" />
              Set as Orchestrator
            </button>
          </div>
        )}
      </div>

      {/* Top Right: Add button */}
      {!isSidebarOpen && !readOnly && (
        <div className="absolute top-3 right-3 z-50 flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSidebarOpen(true)}
            className="transition-colors shadow-sm rounded-lg size-7 bg-white hover:bg-zinc-50 text-zinc-600 border-zinc-200"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Execute button */}
      {!readOnly && onSave && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 dark:bg-[#18181b] dark:hover:bg-[#27272a] dark:text-zinc-100 dark:border-zinc-800 shadow-lg shadow-black/5 dark:shadow-black/40 px-5 py-2 rounded-full font-medium tracking-wide flex items-center gap-2 transition-colors"
          >
            <Play className="size-3.5 fill-current" />
            {saving ? "Saving..." : "Execute workflow"}
          </Button>
        </div>
      )}

      {/* Right sidebars */}
      {readOnly && outputPanelNode && executionStates && executionStates[outputPanelNode.id] ? (
        <div className="w-80 border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] shrink-0 flex flex-col z-20 shadow-none h-full relative">
          <NodeOutputPanel
            nodeId={outputPanelNode.id}
            nodeName={outputPanelNode.data?.webletName as string || "Agent"}
            nodeIcon={outputPanelNode.data?.iconUrl as string || null}
            executionState={executionStates[outputPanelNode.id]}
            onClose={() => setOutputPanelNode(null)}
          />
        </div>
      ) : !readOnly && selectedNode ? (
        <div className="w-80 border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] shrink-0 flex flex-col z-20 shadow-none h-full relative">
          <NodeSettingsPanel
            node={selectedNode}
            onUpdate={updateNodeData}
            onDelete={deleteNode}
            onClose={() => setSelectedNode(null)}
          />
        </div>
      ) : !readOnly ? (
        <div
          className={`
            border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] shrink-0 flex flex-col z-20 shadow-none transition-all duration-300 ease-in-out h-full relative
            ${isSidebarOpen ? "w-80" : "w-0 overflow-hidden border-none"}
          `}
        >
          <div className="w-80 h-full flex flex-col">
            <WebletSidebar weblets={weblets} onWebletClick={onWebletClick} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Wrapped with ReactFlowProvider ──
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

// ═══════════════════════════════════════════
// ── Serialization utilities ──
// ═══════════════════════════════════════════

/**
 * Convert DB flow data (steps array) → canvas nodes + edges for React Flow.
 */
export function deserializeFlow(
  steps: FlowStepSerialized[],
  defaultPrompt: string,
  webletMap: Map<string, WebletItem>,
  canvasLayout?: CanvasState | null
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (canvasLayout && canvasLayout.nodes.length > 0) {
    const nodes = canvasLayout.nodes
      .filter((n) => (n.type as string) !== "output")
      .map((n) => {
        if ((n.type === "weblet" || n.type === "orchestrator") && n.data?.webletId) {
          const weblet = webletMap.get(n.data.webletId as string);
          if (weblet) {
            return {
              ...n,
              data: {
                ...n.data,
                webletName: weblet.name,
                iconUrl: weblet.iconUrl,
                category: weblet.category,
                description: weblet.description || "",
                tools: weblet.tools || [],
              },
            };
          }
        }
        return n;
      });

    return {
      nodes,
      edges: canvasLayout.edges.filter((e) => !e.target.includes("output") && !e.source.includes("output")),
    };
  }

  // Fallback: build from steps array
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  const promptNode: FlowNode = {
    id: "prompt-1",
    type: "prompt",
    position: { x: 0, y: 150 },
    data: { label: "Input Prompt", prompt: defaultPrompt || "" },
  };
  nodes.push(promptNode);

  const xSpacing = 220;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const weblet = webletMap.get(step.webletId);

    const webletNode: FlowNode = {
      id: `weblet-${step.webletId}-${i}`,
      type: "weblet",
      position: { x: (i + 1) * xSpacing, y: 150 },
      data: {
        label: weblet?.name || "Agent",
        webletId: step.webletId,
        webletName: weblet?.name || "Unknown Agent",
        iconUrl: weblet?.iconUrl || null,
        category: weblet?.category || "",
        role: step.role || "",
        stepPrompt: step.stepPrompt || "",
        hitlGate: step.hitlGate || false,
        description: weblet?.description || "",
        tools: weblet?.tools || [],
      },
    };
    nodes.push(webletNode);

    const sourceId = i === 0 ? "prompt-1" : nodes[i].id;
    edges.push({
      id: `e-${sourceId}-${webletNode.id}`,
      source: sourceId,
      target: webletNode.id,
      ...defaultEdgeOptions,
    });
  }

  return { nodes, edges };
}

/**
 * Convert canvas nodes + edges → DB steps array for saving.
 */
export function serializeFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  mode?: FlowMode,
  masterWebletId?: string | null
): {
  steps: FlowStepSerialized[];
  prompt: string;
  canvasState: CanvasState;
  mode: FlowMode;
  masterWebletId: string | null;
} {
  const promptNode = nodes.find((n) => n.type === "prompt");
  const prompt = (promptNode?.data as PromptNodeData)?.prompt || "";

  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  const steps: FlowStepSerialized[] = [];
  const visited = new Set<string>();

  function walk(nodeId: string, order: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === "weblet" || node.type === "orchestrator") {
      const data = node.data as WebletNodeData;
      if (data.webletId) {
        steps.push({
          webletId: data.webletId,
          order,
          inputMapping: order === 1 ? "original" : "previous",
          hitlGate: data.hitlGate || false,
          role: data.role || "",
          stepPrompt: data.stepPrompt || "",
        });
      }
    }

    const targets = adj.get(nodeId) || [];
    for (const targetId of targets) {
      walk(targetId, node.type === "weblet" || node.type === "orchestrator" ? order + 1 : order);
    }
  }

  if (promptNode) walk(promptNode.id, 1);

  steps.sort((a, b) => a.order - b.order);
  steps.forEach((s, i) => {
    s.order = i + 1;
    s.inputMapping = i === 0 ? "original" : "previous";
  });

  // In HYBRID, ensure master weblet is listed as step 1
  if (mode === "HYBRID" && masterWebletId) {
    const masterIdx = steps.findIndex((s) => s.webletId === masterWebletId);
    if (masterIdx > 0) {
      const [master] = steps.splice(masterIdx, 1);
      steps.unshift(master);
      steps.forEach((s, i) => { s.order = i + 1; });
    }
  }

  // Map legacy SEQUENTIAL → PARALLEL; new flows are always DAG or HYBRID
  const resolvedMode: FlowMode = (mode === "SEQUENTIAL" || !mode) ? "PARALLEL" : mode;

  return {
    steps,
    prompt,
    canvasState: {
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
      mode: resolvedMode,
      masterWebletId: masterWebletId ?? null,
    },
    mode: resolvedMode,
    masterWebletId: masterWebletId ?? null,
  };
}
