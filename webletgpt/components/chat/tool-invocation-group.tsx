"use client"

import type { GroupedToolPart } from "@/lib/chat/group-tool-parts"
import { ToolInvocationToggle } from "./tool-invocation-toggle"
import { formatToolName, getActionDescription } from "@/lib/chat/tool-display-utils"

interface ToolInvocationGroupProps {
  group: GroupedToolPart
  onMCPAuthComplete?: () => void
}

const CheckmarkSVG = (
  <svg
    className="size-3.5 text-muted-foreground/70 shrink-0"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 8.5L6.5 12L13 4" />
  </svg>
)

export function ToolInvocationGroup({ group, onMCPAuthComplete }: ToolInvocationGroupProps) {
  switch (group.type) {
    case "tool-single": {
      return (
        <ToolInvocationToggle
          part={group.part}
          onMCPAuthComplete={onMCPAuthComplete}
        />
      )
    }

    case "tool-group-same": {
      const { label, action } = formatToolName(group.toolName)
      const actionDesc = getActionDescription(label, action)

      if (group.isLoading) {
        return (
          <div className="my-1.5 py-0.5" data-tool-group="same-loading">
            <span className="text-sm font-medium tool-shimmer">
              {actionDesc} ×{group.count}
            </span>
          </div>
        )
      }

      if (group.isDone) {
        return (
          <div className="my-1 py-0.5 flex items-center gap-1.5" data-tool-group="same-done">
            {CheckmarkSVG}
            <span className="text-[13px] text-muted-foreground/70">
              {actionDesc} ×{group.count}
            </span>
          </div>
        )
      }

      return (
        <div className="my-1 py-0.5 flex items-center gap-1.5" data-tool-group="same-fallback">
          <span className="text-[13px] text-muted-foreground/70">
            {actionDesc} ×{group.count}
          </span>
        </div>
      )
    }

    case "tool-group-parallel": {
      const inlineLabel = group.tools
        .map((t) => {
          const { label, action } = formatToolName(t.toolName)
          return getActionDescription(label, action)
        })
        .join(" · ")

      if (group.isLoading) {
        return (
          <div className="my-1.5 py-0.5" data-tool-group="parallel-loading">
            <span className="text-sm font-medium tool-shimmer">
              {inlineLabel}
            </span>
          </div>
        )
      }

      if (group.isDone) {
        return (
          <div className="my-1 py-0.5 flex items-center gap-1.5" data-tool-group="parallel-done">
            {CheckmarkSVG}
            <span className="text-[13px] text-muted-foreground/70">
              {inlineLabel}
            </span>
          </div>
        )
      }

      return (
        <div className="my-1 py-0.5 flex items-center gap-1.5" data-tool-group="parallel-fallback">
          <span className="text-[13px] text-muted-foreground/70">
            {inlineLabel}
          </span>
        </div>
      )
    }
  }
}
