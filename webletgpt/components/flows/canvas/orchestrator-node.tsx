"use client";
import React, { memo, useState, useEffect } from "react";

import { Handle, Position, useReactFlow, type NodeProps, useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import { Bot, Crown, Wrench, Settings, Loader2, CheckCircle2, XCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PremiumSpinner } from "@/components/ui/premium-spinner";
import type { WebletNodeData, McpToolInfo } from "./types";

function AgentIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const src = iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(name)}&size=64`;
  if (err) return <Bot className="size-full text-amber-400" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={name} className="size-full object-contain shrink-0" onError={() => setErr(true)} />
  );
}

function OrchestratorNodeComponent({ id, data, selected }: NodeProps & { data: WebletNodeData }) {
  const { deleteElements } = useReactFlow();
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const tools: McpToolInfo[] = (data.tools as McpToolInfo[]) || [];
  const isRunning = data.executionState?.status === "running";
  const isCompleted = data.executionState?.status === "completed";
  const isFailed = data.executionState?.status === "failed";

  useEffect(() => {
    updateNodeInternals(id);
    const timer = setTimeout(() => updateNodeInternals(id), 50);
    const timer2 = setTimeout(() => updateNodeInternals(id), 300);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, [id, data.executionState?.activeTool, updateNodeInternals, isRunning]);

  const openSidebar = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("openNodeOutput", { detail: { nodeId } }));
  };

  return (
    <div className="relative group/node" style={{ width: 190 }}>
      {/* Orchestrator glow ring */}
      <div className={`absolute inset-0 rounded-sm pointer-events-none transition-opacity duration-500 ${isRunning ? "opacity-100" : "opacity-60"}`}
        style={{ boxShadow: "0 0 0 1px rgba(245,158,11,0.4), 0 0 16px 2px rgba(245,158,11,0.12)" }}
      />

      <div
        className={`
          flex flex-col relative
          bg-[#0c0900] shadow-xl rounded-sm border
          ${selected ? "border-amber-400/70 ring-1 ring-amber-400/30" : "border-amber-700/60 hover:border-amber-500/70"}
          transition-[border-color,box-shadow] duration-200
        `}
      >
        {/* ORCHESTRATOR label */}
        <div className="absolute -top-2.5 left-2 z-10">
          <span className="text-[8px] font-bold text-amber-500 uppercase tracking-widest bg-[#0c0900] border border-amber-700/50 px-1.5 py-0.5 rounded-[2px] flex items-center gap-1">
            <Crown className="size-2" strokeWidth={2.5} />
            Orchestrator
          </span>
        </div>

        {/* Target handle — sub-agents connect TO orchestrator */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-[#0c0900] !border-2 !border-amber-500 !rounded-full !-left-[7px] z-20"
        />
        {/* Source handle — orchestrator output */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-[#0c0900] !border-2 !border-amber-500 !rounded-full !-right-[7px] z-20"
        />

        {/* Node Header */}
        <div className="p-2 pt-3 flex items-start gap-2 relative">
          <div className="size-7 bg-amber-950/60 rounded-sm border border-amber-700/50 p-1 flex items-center justify-center shrink-0">
            <AgentIcon iconUrl={data.iconUrl} name={data.webletName || "Orchestrator"} />
          </div>

          <div className="flex flex-col overflow-hidden min-w-0 flex-1 pr-4">
            <div className="text-[11px] font-semibold text-amber-200 truncate flex items-center gap-1">
              {data.webletName || "Orchestrator"}
              {isRunning && <PremiumSpinner className="size-3 ml-0.5" />}
              {isCompleted && <CheckCircle2 className="size-3 text-amber-500 shrink-0" />}
              {isFailed && <XCircle className="size-3 text-rose-500 shrink-0" />}
            </div>
            {data.description && (
              <span className="text-[9px] text-amber-700/80 truncate leading-tight">{data.description}</span>
            )}
          </div>

          {/* Action Group - Revealed on Hover */}
          <TooltipProvider delayDuration={0}>
            <div className="absolute -right-2 -top-0 z-50 flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-all duration-200">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="size-4 rounded-sm bg-[#0c0900] border border-amber-700/50 shadow-md flex items-center justify-center text-amber-700 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 transition-all"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id }] }); }}
                  >
                    <Trash2 className="size-2.5" strokeWidth={2.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" hideArrow className="bg-black border border-white/40 text-[10px] font-medium text-zinc-100 px-2 py-1 rounded-none shadow-2xl">
                  Delete Orchestrator
                </TooltipContent>
              </Tooltip>

              {tools.length > 0 && (
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          className="size-4 rounded-sm bg-[#0c0900] border border-amber-700/50 shadow-md flex items-center justify-center text-amber-700 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="size-2.5" />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="top" hideArrow className="bg-black border border-white/40 text-[10px] font-medium text-white px-2 py-1 rounded-none shadow-2xl">
                      View Tools
                    </TooltipContent>
                  </Tooltip>
                  <PopoverContent
                    className="w-56 bg-black border-zinc-800 p-2.5 shadow-xl rounded-sm text-white"
                    align="start" side="right"
                    onPointerDown={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Crown className="size-2.5" /> {data.webletName} Tools
                      </div>
                      <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-1">
                        {tools.map(tool => (
                          <div key={tool.id} className="flex flex-col p-1.5 bg-[#111113] border border-zinc-800/40 rounded-sm">
                            <div className="flex items-center gap-1">
                              <Wrench className="size-2.5 text-amber-600" />
                              <span className="text-[10px] text-zinc-300 font-mono truncate">{tool.label || tool.toolName}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </TooltipProvider>
        </div>

        {/* Dynamic States */}
        <div className="px-2 pb-2 flex flex-col items-center gap-1.5">
          {isRunning && data.executionState?.activeTool && (
            <div className="w-full bg-[#0c0900] border border-amber-800/40 rounded-sm p-1.5 flex flex-col gap-1.5 relative overflow-hidden">
              <div className="flex items-center justify-between w-full">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">TOOL</span>
                <Settings className="size-3 text-amber-500 animate-gear-rotate" />
              </div>
              <div className="w-full bg-black border border-amber-900/30 rounded-sm flex items-center justify-center py-1.5">
                <span className="text-[10px] text-amber-400 font-mono font-bold truncate tracking-tight">
                  {data.executionState.activeTool.toolName}
                </span>
              </div>
            </div>
          )}

          {(isCompleted || isFailed) && (
            <div
              className="w-full bg-[#0c0900] border border-amber-800/40 rounded-sm px-2 py-1 flex items-center justify-between cursor-pointer hover:bg-amber-900/20 transition-all group/output"
              onClick={openSidebar}
            >
              <span className="text-[10px] font-medium text-amber-200">Execution Output</span>
              <span className="text-[9px] text-amber-500 font-bold group-hover/output:text-amber-300 transition-colors">VIEW ›</span>
            </div>
          )}

          {!isRunning && !isCompleted && !isFailed && (
            <div className="w-full bg-[#0c0900]/60 border border-amber-800/30 rounded-sm px-2 py-1 flex items-center gap-1.5">
              <Crown className="size-2.5 text-amber-600" />
              <span className="text-[9px] text-amber-700 font-medium">Master orchestrator · delegates to sub-agents</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const OrchestratorNodeMemo = memo(OrchestratorNodeComponent);
