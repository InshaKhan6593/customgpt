"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/**
 * n8n-style edge: dashed bezier with a subtle animated dot flowing
 * from source → target.
 */
export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const strokeColor = selected ? "#3b82f6" : "rgba(113, 113, 122, 0.5)";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: 1.5,
          strokeDasharray: "4 4",
          fill: "none",
          transition: "stroke 0.2s ease",
        }}
      />
      {/* Premium glowing animated dot traveling along the edge */}
      <circle r="3" fill="#3b82f6" filter="drop-shadow(0 0 4px rgba(59,130,246,0.8))">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}
