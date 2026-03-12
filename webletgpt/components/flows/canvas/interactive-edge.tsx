"use client";

import React, { useState, useCallback } from "react";
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    getSmoothStepPath,
    useReactFlow,
    MarkerType,
    type EdgeProps,
} from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Custom interactive edge with hover-revealed "+" and "x" buttons.
 */
export function InteractiveEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
    markerEnd,
    className,
}: EdgeProps & { className?: string }) {
    const { setEdges } = useReactFlow();
    const [isHovered, setIsHovered] = useState(false);

    const isBackward = targetX <= sourceX + 20;
    const pathConfig = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };

    const [edgePath, labelX, labelY] = isBackward
        ? getSmoothStepPath({ ...pathConfig, borderRadius: 4 })
        : getBezierPath(pathConfig);

    const strokeColor = selected ? "#e4e4e7" : "#52525b"; // zinc-200 when selected, zinc-600 otherwise

    const onEdgeDelete = useCallback(
        (evt: React.MouseEvent) => {
            evt.stopPropagation();
            setEdges((edges) => edges.filter((edge) => edge.id !== id));
        },
        [id, setEdges]
    );

    const onEdgeAdd = useCallback((evt: React.MouseEvent) => {
        evt.stopPropagation();
        window.dispatchEvent(new CustomEvent("openWebletSidebar"));
    }, []);

    const handleMouseEnter = useCallback(() => setIsHovered(true), []);
    const handleMouseLeave = useCallback(() => setIsHovered(false), []);

    return (
        <g
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={className}
            style={{ pointerEvents: "all" }}
        >
            {/* Invisible wide path for hover detection */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={20}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
            />
            {/* Visible thin edge background (for light effect) */}
            {(className?.includes("input-glowing-edge") || className?.includes("glowing-edge")) && (
                <path
                    d={edgePath}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    style={{ opacity: 0.15 }}
                />
            )}
            {/* Visible thin edge */}
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={(className?.includes("glowing-edge") || className?.includes("input-glowing-edge"))
                    ? "url(#arrow-amber)" 
                    : (isHovered || selected ? "url(#arrow-zinc-200)" : "url(#arrow-zinc-400)")}
                style={{
                    stroke: (className?.includes("glowing-edge") || className?.includes("input-glowing-edge"))
                        ? "#f59e0b" 
                        : (isHovered || selected ? "#e4e4e7" : "#a1a1aa"),
                    strokeWidth: 1.5,
                    fill: "none"
                }}
            />
            {/* Label buttons */}
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: "absolute",
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        pointerEvents: isHovered || selected ? "all" : "none",
                        opacity: isHovered || selected ? 1 : 0,
                        transition: "opacity 0.2s ease, transform 0.2s ease",
                        zIndex: 50,
                    }}
                    className="nodrag nopan flex items-center justify-center gap-1.5"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onEdgeAdd}
                                    className="flex items-center justify-center size-4 bg-black border border-zinc-700/80 text-zinc-500 rounded-sm hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/40 transition-all shadow-xl"
                                >
                                    <Plus className="size-2" strokeWidth={2} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" hideArrow={true} className="bg-black border border-white/40 text-[10px] font-medium text-zinc-100 px-2 py-1 rounded-none shadow-2xl">
                                Add intermediate node
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={onEdgeDelete}
                                    className="flex items-center justify-center size-4 bg-black border border-zinc-700/80 text-zinc-500 rounded-sm hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50 transition-all shadow-xl"
                                >
                                    <Trash2 className="size-2" strokeWidth={2} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" hideArrow={true} className="bg-black border border-white/40 text-[10px] font-medium text-zinc-100 px-2 py-1 rounded-none shadow-2xl">
                                Remove connection
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </EdgeLabelRenderer>
        </g>
    );
}
