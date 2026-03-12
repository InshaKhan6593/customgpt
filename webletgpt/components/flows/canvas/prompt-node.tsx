"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, useNodeId, useEdges, useReactFlow } from "@xyflow/react";
import { MessageSquareText, Zap, Plus, Trash2, MoreHorizontal, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PromptNodeData } from "./types";

function PromptNodeComponent({ id, data, selected }: NodeProps & { data: PromptNodeData }) {
  const { deleteElements } = useReactFlow();
  const nodeId = useNodeId();
  const edges = useEdges();

  const hasOutgoingConnection = edges.some(edge => edge.source === nodeId);

  const onAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("openWebletSidebar"));
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
                  className="size-4 bg-black border border-zinc-700/80 rounded-sm flex items-center justify-center text-zinc-500 hover:text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all shadow-xl -ml-px"
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

      <TooltipProvider delayDuration={0}>
        <div className="absolute -right-2 -top-2 z-50 flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-all duration-200">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="size-4 rounded-sm bg-black border border-zinc-700/80 shadow-md flex items-center justify-center text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all"
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
              <TooltipContent side="top" hideArrow={true} className="bg-black border border-white/40 text-[10px] font-medium text-zinc-100 px-2 py-1 rounded-none shadow-2xl">
                View Details
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              className="w-56 bg-black border-zinc-800 p-2.5 shadow-xl rounded-sm"
              align="start"
              side="right"
              onPointerDown={(e) => e.stopPropagation()}
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col gap-2">
                <div className="text-[10px] font-semibold text-white uppercase tracking-wider">Input Source Details</div>
                <div className="text-[10px] text-zinc-400 leading-snug break-words">
                  This is the entry point of your workflow. It triggers the first step based on user input or a specified event.
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </TooltipProvider>

      <div
        className={`
          flex flex-col relative
          bg-black shadow-xl rounded-sm border
          ${selected ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-zinc-800 hover:border-zinc-700"}
          transition-all duration-200
        `}
      >
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-amber-600/80 !rounded-full !-right-[6px] z-20"
        />
        {/* Node Header */}
        <div className="p-2 flex items-center gap-2">
          <div className="size-6 bg-black rounded-sm border border-zinc-800 p-1 flex items-center justify-center shrink-0">
            <Zap className="size-4.5 text-amber-500" />
          </div>

          <div className="flex flex-col overflow-hidden min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-zinc-100 truncate flex items-center gap-1">
              Input Source
            </div>
            <span className="text-[9px] text-zinc-500 truncate leading-tight">Flow entry point</span>
          </div>
        </div>

        <div className="px-2 pb-2 flex justify-center">
          <div className="w-full bg-black border border-zinc-800/60 rounded-sm px-2 py-1 flex items-center justify-between">
            <span className="text-[10px] text-white truncate">Waiting for trigger</span>
            {data.prompt ? (
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
                    Add a prompt to start the flow
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export const PromptNodeMemo = memo(PromptNodeComponent);
