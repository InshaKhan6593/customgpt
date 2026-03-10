"use client";

import { memo, useState, useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps, useNodeId, useEdges } from "@xyflow/react";
import { Bot, X, Plus, Wrench, Loader2, CheckCircle2, XCircle, MoreVertical, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WebletNodeData, McpToolInfo } from "./types";

// Deterministic accent color per agent
function getAccentColor(name: string): string {
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#10b981", "#3b82f6", "#f97316"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function AgentIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const src = iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(name)}&size=64`;
  if (err) return <Bot className="size-4 text-zinc-400" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="size-full object-contain shrink-0" onError={() => setErr(true)} />
  );
}

function ToolIcon({ iconUrl, label }: { iconUrl: string | null; label: string }) {
  const [err, setErr] = useState(false);
  if (!iconUrl || err) return <Wrench className="size-2.5 text-zinc-400" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={iconUrl} alt={label} className="size-3 object-contain rounded-[2px]" onError={() => setErr(true)} />
  );
}

// Removed ToolChip in favor of new design

function WebletNodeComponent({ id, data, selected }: NodeProps & { data: WebletNodeData }) {
  const hasRole = data.role && data.role !== "Custom";
  const { deleteElements } = useReactFlow();
  const nodeId = useNodeId();
  const edges = useEdges();

  const hasOutgoingConnection = edges.some(edge => edge.source === nodeId);
  const tools: McpToolInfo[] = (data.tools as McpToolInfo[]) || [];
  const hasTools = tools.length > 0;
  const accent = getAccentColor(data.webletName || "Agent");

  const onDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [id, deleteElements]);

  const onAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("openWebletSidebar"));
  };

  return (
    <div className="group/node relative flex flex-col items-center">
      <div className="relative">
        <div
          className={`
            relative flex items-center justify-center w-[56px] h-[56px] bg-white dark:bg-zinc-950
            border rounded-md shadow-sm cursor-pointer transition-all duration-300
            ${selected
              ? "border-zinc-400 dark:border-zinc-500 ring-2 ring-zinc-400/20 dark:ring-zinc-500/20"
              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
            }
          `}
        >
          {/* Icon */}
          <div className="size-7 bg-transparent flex items-center justify-center p-0.5">
            <AgentIcon iconUrl={data.iconUrl} name={data.webletName || "Agent"} />
          </div>

          {/* 3-dot Capabilities Menu - Absolute Floating Right (Hover only) */}
          {!data.executionState && (
            <div className="absolute -top-1 -right-1 opacity-0 group-hover/node:opacity-100 transition-opacity z-30">
              <Popover>
                <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="size-3.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-[2px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm">
                    <MoreVertical className="size-2.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-[220px] p-2.5 text-xs z-[100]" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{data.webletName || "AI Agent"}</span>
                      <span className="text-[8px] font-medium bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 px-1 py-0.5 rounded tracking-wide uppercase">
                        {data.category || "agent"}
                      </span>
                    </div>
                    {data.description && (
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed border-b border-zinc-100 dark:border-zinc-800/50 pb-2 mb-1">
                        {data.description}
                      </div>
                    )}

                    {hasRole && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Role</span>
                        <div className="text-[9px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded w-fit">{data.role}</div>
                      </div>
                    )}

                    {hasTools && (
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Configured Tools & MCP</span>
                        <div className="flex flex-wrap gap-1">
                          {tools.map(t => (
                            <div key={t.id} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded text-[9px] text-zinc-700 dark:text-zinc-300">
                              <ToolIcon iconUrl={t.iconUrl} label={t.label} />
                              <span className="truncate max-w-[120px] font-medium">{t.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasRole && !hasTools && (
                      <div className="text-[10px] italic text-zinc-400 dark:text-zinc-500 mt-1">
                        No additional tools or specific roles configured.
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Status indicators placed intuitively inside the block */}
          {(hasRole || data.hitlGate || data.stepPrompt?.trim()) && (
            <div className="absolute -bottom-1.5 flex items-center justify-center gap-0.5 z-20 bg-white/50 dark:bg-black/50 backdrop-blur-[2px] px-1 rounded-full border border-zinc-100 dark:border-zinc-800">
              {hasRole && <span className="size-1 rounded-full bg-primary shadow-sm" title="Custom Role" />}
              {data.hitlGate && <span className="size-1 rounded-full bg-amber-500 shadow-sm" title="HITL Gate" />}
              {data.stepPrompt?.trim() && <span className="size-1 rounded-full bg-blue-400 shadow-sm" title="Step Prompt" />}
            </div>
          )}

          {/* Execution Status Bar (Bottom border style) */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden rounded-b-md z-20">
            {data.executionState?.status === "running" && (
              <div className="h-[3px] w-full bg-emerald-500 animate-pulse" />
            )}
            {data.executionState?.status === "completed" && (
              <div className="h-[3px] w-full bg-emerald-500/80" />
            )}
            {data.executionState?.status === "failed" && (
              <div className="h-[3px] w-full bg-rose-500" />
            )}
          </div>
        </div>

        {/* Execution Status Icon */}
        {data.executionState?.status === "running" && (
          <div className="absolute -top-1.5 -right-1.5 text-emerald-500 z-20 bg-white dark:bg-zinc-950 border border-emerald-100 dark:border-emerald-900 rounded-full p-0.5 shadow-sm">
            <Settings className="size-3.5 animate-[spin_2s_linear_infinite]" />
          </div>
        )}
        {data.executionState?.status === "completed" && (
          <div className="absolute -top-1 -right-1 text-emerald-500 z-20 bg-white dark:bg-zinc-950 rounded-full">
            <CheckCircle2 className="size-3" />
          </div>
        )}
        {data.executionState?.status === "failed" && (
          <div className="absolute -top-1 -right-1 text-rose-500 z-20 bg-white dark:bg-zinc-950 rounded-full">
            <XCircle className="size-3" />
          </div>
        )}

        {/* Handles — absolute centered on edges to guarantee exactly half overlapping */}
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !min-w-0 !min-h-0 !bg-zinc-400 dark:!bg-zinc-600 !border-[3px] !border-zinc-50 dark:!border-zinc-950 !rounded-full !-left-[6px] !z-20" />
        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !min-w-0 !min-h-0 !bg-zinc-400 dark:!bg-zinc-600 !border-[3px] !border-zinc-50 dark:!border-zinc-950 !rounded-full !-right-[6px] !z-20" />

        {/* Extend + add button — outside overflow-hidden, visible on hover */}
        {!hasOutgoingConnection && (
          <div className="absolute left-[calc(100%+3px)] top-1/2 -translate-y-1/2 flex items-center z-30 gap-0 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-auto">
            <div className="w-6 h-[1px] bg-zinc-300 dark:bg-zinc-500" />
            <button onClick={onAddClick} className="size-2.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-[2px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm">
              <Plus className="size-1.5" strokeWidth={3} />
            </button>
          </div>
        )}
      </div>

      {/* Animated Tool Gear Node (Execution Mode ONLY) */}
      {data.executionState?.status === "running" && data.executionState.activeTool && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-50">
          <div className="relative flex items-center justify-center p-0.5 rounded-full bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(16,185,129,1)_360deg)] animate-[spin_1s_linear_infinite]">
            <div className="flex items-center justify-center size-7 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 rounded-full shadow-md relative z-10">
              <Wrench className="size-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            </div>
          </div>
          <div className="mt-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-900/50 shadow-sm">
            <span className="text-[8px] font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              {data.executionState.activeTool.toolName}
            </span>
          </div>
          {/* Dashed connector line */}
          <div className="w-[1.5px] h-3 border-l-2 border-dashed border-emerald-300 dark:border-emerald-800 mt-0.5" />
        </div>
      )}

      {/* Completed Tool Dots (Execution Mode ONLY) */}
      {data.executionState?.toolCalls && data.executionState.toolCalls.length > 0 && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 flex flex-wrap justify-center max-w-[140px] items-center gap-1 z-20 pointer-events-none">
          {data.executionState.toolCalls.map((t, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-1 py-0.5 rounded shadow-sm" title={`Used: ${t.toolName}`}>
              <CheckCircle2 className="size-2 text-emerald-500" />
              <span className="text-[7px] font-medium text-emerald-700 dark:text-emerald-400 truncate max-w-[60px]">{t.toolName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const WebletNodeMemo = memo(WebletNodeComponent);
