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

  const strokeColor = selected ? "#6366f1" : "#c4c4c8";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: 1.5,
          strokeDasharray: "6 4",
          fill: "none",
          transition: "stroke 0.2s ease",
        }}
      />
      {/* Animated dot traveling along the dashed edge */}
      <circle r="2.5" fill={selected ? "#6366f1" : "#a1a1aa"} opacity={0.6}>
        <animateMotion dur="4s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}
