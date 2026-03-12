"use client";
import React, { memo, useState } from "react";

import { Handle, Position, useReactFlow, type NodeProps, useNodeId, useEdges, useUpdateNodeInternals } from "@xyflow/react";
import { Bot, Wrench, Settings, Loader2, CheckCircle2, XCircle, Plus, MoreHorizontal, Trash2, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { PremiumSpinner } from "@/components/ui/premium-spinner";
import type { WebletNodeData, McpToolInfo } from "./types";
import { useEffect } from "react";

function AgentIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const src = iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(name)}&size=64`;
  if (err) return <Bot className="size-6 text-zinc-400" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="size-full object-contain shrink-0" onError={() => setErr(true)} />
  );
}

function WebletNodeComponent({ id, data, selected }: NodeProps & { data: WebletNodeData }) {
  const { deleteElements } = useReactFlow();
  const nodeId = useNodeId();
  const edges = useEdges();



  const updateNodeInternals = useUpdateNodeInternals();
  const hasOutgoingConnection = edges.some(edge => edge.source === nodeId);
  const tools: McpToolInfo[] = (data.tools as McpToolInfo[]) || [];
  const isRunning = data.executionState?.status === "running";
  const isCompleted = data.executionState?.status === "completed";
  const isFailed = data.executionState?.status === "failed";

  // Force re-calculate edge positions when the node expands for a tool call
  useEffect(() => {
    updateNodeInternals(id);
    // Call again after a short delay to catch any layout shifts or transition completion
    const timer = setTimeout(() => updateNodeInternals(id), 50);
    const timer2 = setTimeout(() => updateNodeInternals(id), 300);
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [id, data.executionState?.activeTool, updateNodeInternals, isRunning]);

  const onAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("openWebletSidebar"));
  };



  const openSidebar = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("openNodeOutput", { detail: { nodeId } }));
  };

  return (
    <div className="relative group/node" style={{ width: 170 }}>
      {/* Extended connection line + button */}
      {!hasOutgoingConnection && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 flex items-center z-50 ml-3">
          <div className="w-10 h-[1.5px] bg-zinc-700/60" />
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onAddClick}
                  className="size-4 bg-zinc-900 border border-zinc-700/80 rounded-[4px] flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-600 transition-all shadow-xl -ml-px"
                >
                  <Plus className="size-2" strokeWidth={3} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" hideArrow={true} className="bg-black border border-white/40 text-[10px] font-medium text-zinc-100 px-2 py-1 rounded-none shadow-2xl">
                Connect Next Step
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      <div
        className={`
          flex flex-col relative
          bg-black shadow-xl rounded-sm border
          ${selected ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-zinc-800 hover:border-zinc-700"}
          transition-[border-color,box-shadow,background-color] duration-200
        `}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-amber-600/80 !rounded-full !-left-[6px] z-20"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-amber-600/80 !rounded-full !-right-[6px] z-20"
        />

        {/* Node Header */}
        <div className="p-2 flex items-start gap-2 relative">
          <div className="size-6 bg-zinc-900 rounded-sm border border-zinc-800 p-1 flex items-center justify-center shrink-0">
            <AgentIcon iconUrl={data.iconUrl} name={data.webletName || "Agent"} />
          </div>

          <div className="flex flex-col overflow-hidden min-w-0 flex-1 pr-4">
            <div className="text-[11px] font-semibold text-zinc-100 truncate flex items-center gap-1">
              {data.webletName || "Agent"}
              {isRunning && <PremiumSpinner className="size-3 ml-0.5" />}
              {isCompleted && <CheckCircle2 className="size-3 text-amber-500 shrink-0" />}
              {isFailed && <XCircle className="size-3 text-rose-500 shrink-0" />}
            </div>
            {data.description && <span className="text-[9px] text-zinc-500 truncate leading-tight">{data.description}</span>}
          </div>

          {/* Action Group (Delete + Info) - Revealed on Hover */}
          <TooltipProvider delayDuration={0}>
            <div className="absolute -right-2 -top-2 z-50 flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-all duration-200">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="size-4 rounded-sm bg-black border border-zinc-700/80 shadow-md flex items-center justify-center text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteElements({ nodes: [{ id }] });
                    }}
                  >
                    <Trash2 className="size-2.5" strokeWidth={2.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" hideArrow={true} className="bg-black border border-white/40 text-[10px] font-medium text-zinc-100 px-2 py-1 rounded-none shadow-2xl">
                  Delete Node
                </TooltipContent>
              </Tooltip>

              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        className="size-4 rounded-sm bg-black border border-zinc-700/80 shadow-md flex items-center justify-center text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <MoreHorizontal className="size-2.5" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" hideArrow={true} className="bg-black border border-white/40 text-[10px] font-medium text-white px-2 py-1 rounded-none shadow-2xl">
                    View Details
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  className="w-56 bg-black border-zinc-800 p-2.5 shadow-xl rounded-sm text-white"
                  align="start"
                  side="right"
                  onPointerDown={(e) => e.stopPropagation()}
                  onWheel={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">{data.webletName || "Agent"} Details</div>
                    {data.description && (
                      <div className="text-[10px] text-zinc-500 leading-snug break-words">
                        {data.description}
                      </div>
                    )}
                    {tools.length > 0 && (
                      <div className="mt-1 flex flex-col gap-1.5">
                        <div className="text-[9px] font-semibold text-zinc-400 uppercase">Available Tools</div>
                        <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-1">
                          {tools.map(tool => (
                            <div key={tool.id} className="flex flex-col p-1.5 bg-[#111113] border border-zinc-800/40 rounded-sm">
                              <div className="flex items-center gap-1">
                                <Wrench className="size-2.5 text-zinc-500" />
                                <span className="text-[10px] text-zinc-300 font-mono truncate">{tool.label || tool.toolName}</span>
                              </div>
                              {tool.description && (
                                <span className="text-[9px] text-zinc-500 leading-tight mt-0.5 break-words line-clamp-2">{tool.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </TooltipProvider>
        </div>



        {/* Dynamic States & Interactions */}
        <div className="px-2 pb-2 flex flex-col items-center gap-1.5">
          {/* Active Tool state when running */}
          {isRunning && data.executionState?.activeTool && (
            <div className="w-full bg-black border border-zinc-800/60 rounded-sm p-1.5 flex flex-col gap-1.5 relative overflow-hidden">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1">
                   <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">TOOL</span>
                </div>
                <div className="flex items-center justify-center glow-amber">
                  <Settings className="size-3 text-amber-500 animate-gear-rotate" />
                </div>
              </div>
              <div className="w-full bg-black border border-amber-900/30 rounded-sm flex items-center justify-center py-1.5">
                 <span className="text-[10px] text-amber-400 font-mono font-bold truncate tracking-tight">{data.executionState.activeTool.toolName}</span>
              </div>
            </div>
          )}

          {/* Completed state hint */}
          {(isCompleted || isFailed) && (
            <div
              className="w-full bg-black border border-zinc-800/60 rounded-sm px-2 py-1 flex items-center justify-between cursor-pointer hover:bg-zinc-800/80 transition-all group/output"
              onClick={openSidebar}
            >
              <span className="text-[10px] font-medium text-white">Execution Output</span>
              <span className="text-[9px] text-white font-bold group-hover/output:text-amber-500 transition-colors">VIEW ›</span>
            </div>
          )}

          {/* Action Bottom Bar */}
          {!isRunning && !isCompleted && !isFailed && (
            <button
              className="w-full bg-black border border-zinc-800/60 rounded-sm px-2 py-1 flex items-center justify-between text-[10px] font-medium text-white hover:bg-white/5 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("selectNode", { detail: { nodeId: id } }));
              }}
            >
              <div className="flex items-center gap-1.5 truncate">
                <div className="size-4 rounded-sm bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-amber-500 group-hover:bg-amber-500/10 group-hover:border-amber-500/40 transition-all">
                  <Plus className="size-2" strokeWidth={3} />
                </div>
                <span>{data.stepPrompt ? "Edit Instructions" : "Add Instruction"}</span>
              </div>
              {data.stepPrompt ? (
                <div className="size-1.5 rounded-full bg-amber-500 animate-pulse shrink-0 ml-2" />
              ) : (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="shrink-0 ml-2 cursor-help">
                        <AlertTriangle className="size-3 text-rose-500" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" hideArrow={true} className="bg-black border border-white/40 text-[10px] font-medium text-white px-2 py-1 rounded-none shadow-2xl">
                      Add instructions to proceed
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export const WebletNodeMemo = memo(WebletNodeComponent);
