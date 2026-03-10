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
import { InteractiveEdge } from "./interactive-edge";
import { WebletSidebar } from "./weblet-sidebar";
import { Plus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NodeSettingsPanel } from "./node-settings-panel";
import { NodeOutputPanel } from "./node-output-panel";
import type {
  FlowNode,
  FlowEdge,
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
} as unknown as NodeTypes;

// ── Edge type registry ──
const edgeTypes: EdgeTypes = {
  interactive: InteractiveEdge,
} as unknown as EdgeTypes;

// ── Default edge style ──
const defaultEdgeOptions = {
  type: "interactive",
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 6,
    height: 6,
    color: "#71717a",
  },
};

/** Ensure all edges use the interactive type + correct marker */
function normalizeEdges(edges: FlowEdge[]): FlowEdge[] {
  return edges.map((e) => ({
    ...e,
    type: "interactive",
    markerEnd: defaultEdgeOptions.markerEnd,
  }));
}

const connectionLineStyle = {
  stroke: "#71717a", // zinc-500
  strokeWidth: 1,
};

// ── Props ──
interface FlowCanvasProps {
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
  weblets: WebletItem[];
  defaultPrompt: string;
  onSave?: (data: { nodes: FlowNode[]; edges: FlowEdge[]; prompt: string }) => void;
  saving?: boolean;
  onChange?: (data: { nodes: FlowNode[]; edges: FlowEdge[]; prompt: string }) => void;
  readOnly?: boolean;
  executionStates?: Record<string, NodeExecutionState>;
}

function FlowCanvasInner({
  initialNodes,
  initialEdges,
  weblets,
  defaultPrompt,
  onSave,
  saving,
  onChange,
  readOnly = false,
  executionStates,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(normalizeEdges(initialEdges));
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [outputPanelNode, setOutputPanelNode] = useState<FlowNode | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleOpenSidebar = () => setIsSidebarOpen(true);
    window.addEventListener("openWebletSidebar", handleOpenSidebar);
    return () => window.removeEventListener("openWebletSidebar", handleOpenSidebar);
  }, []);

  // Listen for flow finish event to auto-select the last active node
  useEffect(() => {
    const handleExecComplete = (e: CustomEvent) => {
      const events = e.detail?.events || [];
      // Find the last node that completed or failed
      const lastEvent = [...events].reverse().find((ev: any) => ev.type === "node_completed" || ev.type === "step_failed");
      if (lastEvent?.data?.nodeId) {
        const targetNode = nodes.find(n => n.id === lastEvent.data.nodeId);
        if (targetNode) setOutputPanelNode(targetNode);
      }
    };
    window.addEventListener("flowExecutionCompleted", handleExecComplete as EventListener);
    return () => window.removeEventListener("flowExecutionCompleted", handleExecComplete as EventListener);
  }, [nodes]);

  // If we change from execution -> builder, clear output panel
  useEffect(() => {
    if (!readOnly) {
      setOutputPanelNode(null);
    } else {
      setSelectedNode(null); // Clear settings panel if running starts
    }
  }, [readOnly]);

  // ── Sync execution states ──
  useEffect(() => {
    if (!executionStates) return;
    // Sync node execution states
    setNodes((nds) =>
      nds.map((n) => {
        const state = executionStates[n.id];
        if (!state) return n;
        return {
          ...n,
          data: { ...n.data, executionState: state }
        } as FlowNode;
      })
    );

    // Sync edge execution states (animations)
    setEdges((eds) =>
      eds.map((e) => {
        const targetState = executionStates[e.target];
        const sourceState = executionStates[e.source];

        let className = "";
        let animated = false;

        // If the target node is running, make the edge flow into it glow
        if (targetState?.status === "running") {
          className = "glowing-edge";
          animated = true;
        }
        // If the source node is completed, the edge is "done" transferring
        else if (sourceState?.status === "completed") {
          className = "completed-edge";
        }

        return {
          ...e,
          className,
          animated,
        };
      })
    );
  }, [executionStates, setNodes, setEdges]);

  // ── Connect nodes ──
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
    },
    [setEdges]
  );

  // ── Node click → open settings or output ──
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
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

  // ── Pane click → close settings & sidebar ──
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsSidebarOpen(false);
    setOutputPanelNode(null);
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

  // ── Drop weblet from sidebar onto canvas ──
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

      const newNode: FlowNode = {
        id: `weblet-${Date.now()}`,
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
    },
    [screenToFlowPosition, setNodes]
  );

  // ── Click weblet from sidebar to add to canvas ──
  const onWebletClick = useCallback(
    (weblet: WebletItem) => {
      // Place the new node roughly in the center of the screen
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });

      const newNode: FlowNode = {
        id: `weblet-${Date.now()}`,
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
    },
    [screenToFlowPosition, setNodes]
  );

  // ── Get current prompt from prompt node ──
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
    });
  }, [nodes, edges, currentPrompt]);

  // ── Save handler ──
  const handleSave = useCallback(() => {
    onSave?.({ nodes: nodes as FlowNode[], edges: edges as FlowEdge[], prompt: currentPrompt });
  }, [nodes, edges, currentPrompt, onSave]);

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
          onPaneClick={onPaneClick}
          onDragOver={readOnly ? undefined : onDragOver}
          onDrop={readOnly ? undefined : onDrop}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.3 }}
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
        </ReactFlow>

        {/* Top Right Floating Add Button */}
        {!isSidebarOpen && !readOnly && (
          <div className="absolute top-3 right-3 z-10 flex gap-2">
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

        {!readOnly && onSave && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
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

      </div>

      {/* Right sidebars */}
      {readOnly && outputPanelNode && executionStates && executionStates[outputPanelNode.id] ? (
        <div className="w-80 border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] shrink-0 flex flex-col z-20 shadow-none transition-all h-full relative">
          <NodeOutputPanel
            nodeId={outputPanelNode.id}
            nodeName={outputPanelNode.data?.webletName as string || "Agent"}
            nodeIcon={outputPanelNode.data?.iconUrl as string || null}
            executionState={executionStates[outputPanelNode.id]}
            onClose={() => setOutputPanelNode(null)}
          />
        </div>
      ) : !readOnly && selectedNode ? (
        <div className="w-80 border-l border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] shrink-0 flex flex-col z-20 shadow-none transition-all h-full relative">
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
        if (n.type === "weblet" && n.data?.webletId) {
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

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  // Prompt node (always first)
  const promptNode: FlowNode = {
    id: "prompt-1",
    type: "prompt",
    position: { x: 0, y: 150 },
    data: { label: "Input Prompt", prompt: defaultPrompt || "" },
  };
  nodes.push(promptNode);

  // Weblet nodes from steps
  const xSpacing = 200;
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

    // Edge from previous node
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
 * Walks the graph from prompt → output, following edges in order.
 */
export function serializeFlow(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { steps: FlowStepSerialized[]; prompt: string; canvasState: CanvasState } {
  const promptNode = nodes.find((n) => n.type === "prompt");
  const prompt = (promptNode?.data as PromptNodeData)?.prompt || "";

  // Build adjacency: source → target
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }

  // Walk graph from prompt node following edges
  const steps: FlowStepSerialized[] = [];
  const visited = new Set<string>();

  function walk(nodeId: string, order: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    if (node.type === "weblet") {
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

    // Follow outgoing edges
    const targets = adj.get(nodeId) || [];
    for (const targetId of targets) {
      walk(targetId, node.type === "weblet" ? order + 1 : order);
    }
  }

  if (promptNode) {
    walk(promptNode.id, 1);
  }

  // Sort by order
  steps.sort((a, b) => a.order - b.order);

  // Re-number
  steps.forEach((s, i) => {
    s.order = i + 1;
    s.inputMapping = i === 0 ? "original" : "previous";
  });

  return {
    steps,
    prompt,
    canvasState: { nodes: nodes as FlowNode[], edges: edges as FlowEdge[] },
  };
}
