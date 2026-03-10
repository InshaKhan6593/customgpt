"use client";

import React, { useState, useCallback } from "react";
import {
    BaseEdge,
    EdgeLabelRenderer,
    getBezierPath,
    getSmoothStepPath,
    useReactFlow,
    type EdgeProps,
} from "@xyflow/react";
import { Plus, X } from "lucide-react";

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
}: EdgeProps) {
    const { setEdges } = useReactFlow();
    const [isHovered, setIsHovered] = useState(false);

    const isBackward = targetX <= sourceX + 20;
    const pathConfig = { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };

    const [edgePath, labelX, labelY] = isBackward
        ? getSmoothStepPath({ ...pathConfig, borderRadius: 4 })
        : getBezierPath(pathConfig);

    const strokeColor = selected ? "#a1a1aa" : "#71717a";

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
            style={{ pointerEvents: "all" }}
        >
            {/* Invisible wide path for hover detection */}
            <path
                d={edgePath}
                fill="none"
                stroke="transparent"
                strokeWidth={28}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
            />
            {/* Visible thin edge */}
            <BaseEdge
                id={id}
                path={edgePath}
                markerEnd={markerEnd}
                style={{
                    stroke: isHovered ? "#a1a1aa" : strokeColor,
                    strokeWidth: isHovered ? 1.5 : 1.25,
                    fill: "none",
                    pointerEvents: "none",
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
                        transition: "opacity 0.15s ease",
                        zIndex: 50,
                    }}
                    className="nodrag nopan flex items-center justify-center gap-0.5"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <button
                        onClick={onEdgeAdd}
                        className="flex items-center justify-center size-2.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-[2px] hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors shadow-sm"
                    >
                        <Plus className="size-1.5" strokeWidth={3} />
                    </button>
                    <button
                        onClick={onEdgeDelete}
                        className="flex items-center justify-center size-2.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-[2px] hover:bg-rose-50 dark:hover:bg-rose-500/20 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/30 transition-colors shadow-sm"
                    >
                        <X className="size-1.5" strokeWidth={3} />
                    </button>
                </div>
            </EdgeLabelRenderer>
        </g>
    );
}
