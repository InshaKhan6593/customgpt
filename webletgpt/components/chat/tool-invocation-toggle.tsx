"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { isToolUIPart, getToolName } from "ai"
import type { UIMessagePart } from "ai"

interface ToolInvocationToggleProps {
  part: UIMessagePart<any, any>
}

/** Friendly display names for built-in capability tools */
const TOOL_DISPLAY_NAMES: Record<string, { label: string; action: string }> = {
  webSearch: { label: "Web Search", action: "Searching the web" },
  codeInterpreter: { label: "Code Interpreter", action: "Running code" },
  imageGeneration: { label: "Image Generation", action: "Generating image" },
  fileSearch: { label: "File Search", action: "Searching files" },
}

/** Split camelCase into readable words */
function camelToTitle(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
}

function formatToolName(name: string): { label: string; action: string } {
  // Built-in capability tools (camelCase)
  if (TOOL_DISPLAY_NAMES[name]) {
    return TOOL_DISPLAY_NAMES[name]
  }

  // MCP tools: mcp_server_toolname
  if (name.startsWith("mcp_")) {
    const withoutPrefix = name.slice(4)
    const firstUnderscore = withoutPrefix.indexOf("_")
    if (firstUnderscore > 0) {
      const server = withoutPrefix.slice(0, firstUnderscore).replace(/_/g, " ")
      const action = withoutPrefix.slice(firstUnderscore + 1).replace(/_/g, " ")
      return {
        label: server.charAt(0).toUpperCase() + server.slice(1),
        action,
      }
    }
    return { label: "MCP", action: withoutPrefix.replace(/_/g, " ") }
  }

  // Composition tools: weblet_slug_name
  if (name.startsWith("weblet_")) {
    const slug = name.slice(7).replace(/_/g, " ")
    return { label: "Weblet", action: slug.charAt(0).toUpperCase() + slug.slice(1) }
  }

  // OpenAPI tools: get_users, post_create_order
  if (/^(get|post|put|patch|delete)_/.test(name)) {
    const firstUnderscore = name.indexOf("_")
    const method = name.slice(0, firstUnderscore).toUpperCase()
    const path = name.slice(firstUnderscore + 1).replace(/_/g, " ")
    return { label: "API", action: `${method} ${path}` }
  }

  // Fallback: handle both camelCase and snake_case
  if (name.includes("_")) {
    const words = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    return { label: words, action: "" }
  }

  return { label: camelToTitle(name), action: "" }
}

function formatResult(result: unknown): string {
  if (result === undefined || result === null) return ""
  if (typeof result === "string") {
    return result.length > 600 ? result.slice(0, 600) + "..." : result
  }
  try {
    const json = JSON.stringify(result, null, 2)
    return json.length > 600 ? json.slice(0, 600) + "..." : json
  } catch {
    return String(result)
  }
}

/** Vercel-style action description from tool name */
function getActionDescription(label: string, action: string): string {
  if (!action) return `Used ${label}`
  return `Used ${label}: ${action}`
}

export function ToolInvocationToggle({ part }: ToolInvocationToggleProps) {
  const [open, setOpen] = useState(false)

  const p = part as any
  const toolName = p.toolName ?? (isToolUIPart(part) ? getToolName(part) : "tool")
  const state: string = p.state ?? "input-available"
  const input = p.input ?? p.args
  const output = p.output ?? p.result

  const isLoading = state === "input-streaming" || state === "input-available" || state === "call" || state === "partial-call"
  const isDone = state === "output-available" || state === "result" || state === "error"

  const { label, action } = formatToolName(toolName)
  const actionDesc = getActionDescription(label, action)
  const hasDetails = (input && typeof input === "object" && Object.keys(input).length > 0) || output !== undefined

  return (
    <div className="my-1.5">
      {/* Header row — Vercel-style collapsible */}
      <button
        onClick={() => hasDetails && setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full text-left py-1",
          hasDetails && "cursor-pointer",
          !hasDetails && "cursor-default"
        )}
      >
        {/* Chevron */}
        <svg
          className={cn(
            "size-3 text-zinc-500 transition-transform duration-200 shrink-0",
            open && "rotate-90",
            !hasDetails && "opacity-0"
          )}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Action description */}
        <span className="text-[13px] text-zinc-400">
          {actionDesc}
        </span>

        {/* Spinner or dot indicator */}
        {isLoading && (
          <svg className="size-3 animate-spin text-zinc-500 shrink-0 ml-auto" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Sub-items — file/tool details */}
      <div className={cn(
        "ml-2.5 border-l border-zinc-800 pl-4 space-y-0.5",
        !open && "hidden"
      )}>
        {/* Tool name detail */}
        <div className="flex items-center gap-2 py-1">
          <svg className="size-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="currentColor" />
          </svg>
          <span className="text-[13px] text-zinc-300 font-mono truncate">
            {action || label}
          </span>
          <span className="text-[11px] text-zinc-600 truncate ml-auto">
            {label}
          </span>
        </div>

        {/* Input args */}
        {input && typeof input === "object" && Object.keys(input).length > 0 && (
          <div className="py-1.5">
            <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Input</span>
            <pre className="mt-1 text-[12px] leading-relaxed text-zinc-400 whitespace-pre-wrap break-all font-mono bg-zinc-900/50 rounded px-2.5 py-2 border border-zinc-800/50">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
        )}

        {/* Output */}
        {output !== undefined && (
          <div className="py-1.5">
            <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Output</span>
            <pre className="mt-1 text-[12px] leading-relaxed text-zinc-400 whitespace-pre-wrap break-all font-mono bg-zinc-900/50 rounded px-2.5 py-2 border border-zinc-800/50 max-h-52 overflow-y-auto">
              {formatResult(output)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
