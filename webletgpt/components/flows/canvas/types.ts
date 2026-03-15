import type { Node, Edge } from "@xyflow/react";

// ── Flow mode ──
export type FlowMode = "SEQUENTIAL" | "PARALLEL" | "HYBRID";

// ── Node data types ──

// MCP tool info from the server
export interface McpToolInfo {
  id: string;
  label: string;
  iconUrl: string | null;
  toolName?: string;
  description?: string;
}

export interface PromptNodeData {
  label: string;
  prompt: string;
  [key: string]: unknown;
}

export interface WebletNodeData {
  label: string;
  webletId: string;
  webletName: string;
  iconUrl: string | null;
  category: string;
  role: string;
  stepPrompt: string;
  hitlGate: boolean;
  description: string;
  tools?: McpToolInfo[];
  executionState?: NodeExecutionState;
  isOrchestrator?: boolean;
  [key: string]: unknown;
}

// ── Execution state (for Run mode) ──

export interface ActiveToolCall {
  toolName: string;
  args: any;
}

export interface ToolCallRecord {
  toolName: string;
  args: any;
  result: any;
  state: "running" | "completed";
}

export interface NodeExecutionState {
  status: "pending" | "running" | "completed" | "failed";
  activeTool?: ActiveToolCall;
  output?: string;
  toolCalls?: ToolCallRecord[];
}

// ── Typed nodes ──

export type PromptNode = Node<PromptNodeData, "prompt">;
export type WebletNode = Node<WebletNodeData, "weblet">;
export type OrchestratorNode = Node<WebletNodeData, "orchestrator">;
export type FlowNode = PromptNode | WebletNode | OrchestratorNode;

// ── Edge type ──

export type FlowEdge = Edge;

// ── Weblet item from API ──

export interface WebletItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  category: string;
  tools?: McpToolInfo[];
}

// ── Serialization: canvas → DB steps ──

export interface FlowStepSerialized {
  webletId: string;
  order: number;
  inputMapping: "original" | "previous";
  hitlGate: boolean;
  role: string;
  stepPrompt: string;
}

// ── Canvas state for save/restore ──

export interface CanvasState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  mode?: FlowMode;
  masterWebletId?: string | null;
}
