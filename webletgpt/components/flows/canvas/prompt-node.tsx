"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, useNodeId, useEdges } from "@xyflow/react";
import { MessageSquareText, Zap, Plus } from "lucide-react";
import type { PromptNodeData } from "./types";

function PromptNodeComponent({ data, selected }: NodeProps & { data: PromptNodeData }) {
  const nodeId = useNodeId();
  const edges = useEdges();

  const hasOutgoingConnection = edges.some(edge => edge.source === nodeId);

  const onAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("openWebletSidebar"));
  };

  return (
    <div className="relative flex flex-col items-center group">
      {/* Trigger pill — n8n style */}
      <div
        className={`
          relative w-[48px] h-[36px] bg-white dark:bg-zinc-950 border shadow-sm
          flex items-center justify-center
          rounded-l-full rounded-r-lg
          ${selected
            ? "border-zinc-400 ring-1 ring-zinc-400/20 dark:border-zinc-500 dark:ring-zinc-500/20"
            : "border-zinc-200 dark:border-zinc-800 hover:shadow-md"
          }
        `}
      >
        {/* Lightning bolt indicator */}
        <div className="absolute -left-[6px] top-1/2 -translate-y-1/2 z-10 size-4 bg-transparent flex items-center justify-center text-amber-500">
          <Zap className="size-2.5" />
        </div>

        <MessageSquareText className="size-3 text-zinc-600 dark:text-zinc-400" strokeWidth={1.5} />

        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !min-w-0 !min-h-0 !bg-zinc-400 dark:!bg-zinc-600 !border-[3px] !border-zinc-50 dark:!border-zinc-950 !rounded-full !-right-[6px] !z-20"
        />

        {/* Extending Handle & Add Button */}
        {!hasOutgoingConnection && (
          <div className="absolute left-[calc(100%+3px)] top-1/2 -translate-y-1/2 flex items-center z-10 gap-0">
            <div className="w-6 h-[1px] bg-zinc-300 dark:bg-zinc-500" />
            <button
              onClick={onAddClick}
              className="size-2.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-[2px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              <Plus className="size-1.5" strokeWidth={3} />
            </button>
          </div>
        )}
      </div>

      {/* Label below */}
      <div className="mt-1.5 w-max max-w-[100px]">
        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium text-center leading-tight">
          When chat message received
        </p>
      </div>
    </div>
  );
}

export const PromptNodeMemo = memo(PromptNodeComponent);
