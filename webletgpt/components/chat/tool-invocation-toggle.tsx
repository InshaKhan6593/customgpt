"use client"

import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { isToolUIPart, getToolName } from "ai"
import type { UIMessagePart } from "ai"
import { ChatMarkdown } from "@/components/ui/chat-markdown"
import { MCPOAuthPrompt } from "./mcp-oauth-prompt"

/** Image tools render their result as a visual image, not as JSON output */
const IMAGE_TOOL_NAMES = new Set(["imageGeneration"])

interface ToolInvocationToggleProps {
  part: UIMessagePart<any, any>
  onMCPAuthComplete?: () => void
}

/** Friendly display names for built-in capability tools */
const TOOL_DISPLAY_NAMES: Record<string, { label: string; action: string }> = {
  webSearch: { label: "Web Search", action: "Searching the web" },
  codeInterpreter: { label: "Code Interpreter", action: "Running code" },
  imageGeneration: { label: "Image Generation", action: "Generating image" },
  fileSearch: { label: "File Search", action: "Searching files" },
  presentToUser: { label: "Present to User", action: "Presenting artifact" },
}

/** Split camelCase into readable words */
function camelToTitle(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
}

export function formatToolName(name: string): { label: string; action: string } {
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
export function getActionDescription(label: string, action: string): string {
  if (!action) return `Used ${label}`
  return `Used ${label}: ${action}`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ToolInvocationToggle({ part, onMCPAuthComplete }: ToolInvocationToggleProps) {
  const [open, setOpen] = useState(false)

  const p = part as any
  const toolName = p.toolName ?? (isToolUIPart(part) ? getToolName(part) : "tool")
  const state: string = p.state ?? "input-available"
  const input = p.input ?? p.args
  const output = p.output ?? p.result

  const isLoading = state === "input-streaming" || state === "input-available" || state === "call" || state === "partial-call"
  const isDone = state === "output-available" || state === "result" || state === "error"

  // Elapsed time counter so long-running tools (sandbox, MCP) don't look frozen
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  useEffect(() => {
    if (!isLoading) return
    startRef.current = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000)
    return () => clearInterval(id)
  }, [isLoading])

  // ── Special: MCP auth required — render inline OAuth/PAT prompt ──
  const isAuthRequired = isDone && output && typeof output === "object" && (output as any).__mcp_auth_required === true
  if (isAuthRequired) {
    return (
      <div className="my-1.5">
        <MCPOAuthPrompt
          serverId={(output as any).serverId}
          serverLabel={(output as any).serverLabel}
          catalogId={(output as any).catalogId}
          webletId={(output as any).webletId}
          onConnected={() => onMCPAuthComplete?.()}
        />
      </div>
    )
  }

  const { label, action } = formatToolName(toolName)
  const actionDesc = getActionDescription(label, action)
  const hasDetails = (input && typeof input === "object" && Object.keys(input).length > 0) || output !== undefined

  const isImageTool = IMAGE_TOOL_NAMES.has(toolName)
  const imageError = isImageTool && output && typeof output === "object" && (output as any).error
    ? (output as any).error
    : null

  const isCodeInterpreter = toolName === "codeInterpreter"

  // ── Special: Child weblet tool — rich rendering ──
  const isChildWeblet = toolName.startsWith("weblet_") && output && typeof output === "object" && (output as any)._childExecution
  const childExec = isChildWeblet ? (output as any)._childExecution : null
  const childResponse = isChildWeblet ? (output as any).response : null
  const childSource = isChildWeblet ? (output as any).source : null

  const elapsedStr = elapsed >= 3000 ? ` (${Math.floor(elapsed / 1000)}s)` : ""

  // ── Special: Image tool — loading shimmer + error only (artifact rendered via presentToUser) ──
  if (isImageTool) {
    return (
      <div className="my-1.5">
        <div className="py-0.5">
          <span className={`text-sm ${isLoading ? "font-medium tool-shimmer" : "text-muted-foreground/60"}`}>
            {isLoading ? `Generating image...${elapsedStr}` : actionDesc}
          </span>
        </div>

        {isLoading && (
          <div className="mt-2 rounded-xl overflow-hidden w-full max-w-[280px] aspect-square bg-muted/40 border border-border/40 animate-pulse" />
        )}

        {isDone && imageError && (
          <div className="mt-2 rounded-xl bg-red-950/30 border border-red-800/40 p-4 max-w-[280px]">
            <p className="text-sm text-red-400">{imageError}</p>
          </div>
        )}
      </div>
    )
  }

  // ── Special: Code Interpreter — loading shimmer only (artifacts rendered via presentToUser) ──
  if (isCodeInterpreter) {
    return (
      <div className="my-1.5">
        <div className="py-0.5">
          <span className={`text-[13px] ${isLoading ? "font-medium tool-shimmer" : "text-muted-foreground/60"}`}>
            {isLoading ? `Running Python Code...${elapsedStr}` : actionDesc}
          </span>
        </div>
      </div>
    )
  }

  const isPresentToUser = toolName === "presentToUser"

  // Guarantee the shimmer is visible for at least 600ms so the user always sees
  // the "Presenting artifact…" loading state, even when the tool resolves instantly.
  const [shimmerHold, setShimmerHold] = useState(true)
  const shimmerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!isPresentToUser) return
    shimmerTimerRef.current = setTimeout(() => setShimmerHold(false), 600)
    return () => { if (shimmerTimerRef.current) clearTimeout(shimmerTimerRef.current) }
  }, [isPresentToUser])

  if (isPresentToUser) {
    const presented = isDone && output && typeof output === "object" && (output as any).presented
    const artifactType = (output as any)?.type
    const artifactUrl = (output as any)?.url
    const artifactTitle = (output as any)?.title
    const artifactCaption = (output as any)?.caption
    const artifactFileName = (output as any)?.fileName

    if (isLoading || shimmerHold) {
      return (
        <div className="my-1.5 py-0.5">
          <span className="text-sm font-medium tool-shimmer">
            {`Presenting artifact...${elapsedStr}`}
          </span>
        </div>
      )
    }

    if (!presented || !artifactUrl) {
      return (
        <div className="my-1 py-0.5">
          <span className="text-[13px] text-muted-foreground/60">{actionDesc}</span>
        </div>
      )
    }

    if (artifactType === "image" || artifactType === "chart") {
      return (
        <div className="my-2">
          {artifactCaption && (
            <p className="text-[13px] text-muted-foreground/80 mb-1.5">{artifactCaption}</p>
          )}
          <img
            src={artifactUrl}
            alt={artifactTitle || artifactCaption || "Presented artifact"}
            loading="lazy"
            className="rounded-xl shadow-lg max-w-full md:max-w-[320px] h-auto border border-border/30 transition-opacity duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.style.display = "none"
              target.parentElement!.innerHTML += `<div class="rounded-xl bg-zinc-800/60 border border-zinc-700/40 p-6 text-center text-zinc-500 text-sm max-w-[320px]">Image unavailable</div>`
            }}
          />
          {artifactTitle && !artifactCaption && (
            <p className="text-[12px] text-muted-foreground/50 mt-1">{artifactTitle}</p>
          )}
        </div>
      )
    }

    return (
      <div className="my-2">
        {artifactCaption && (
          <p className="text-[13px] text-muted-foreground/80 mb-1.5">{artifactCaption}</p>
        )}
        <a
          href={artifactUrl}
          download={artifactFileName || artifactTitle || "download"}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 max-w-[320px] rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer group"
        >
          <div className="h-8 w-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {artifactType === "code" ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate">{artifactFileName || artifactTitle || "File"}</p>
            {artifactTitle && artifactFileName && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{artifactTitle}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider group-hover:text-foreground/70 transition-colors">Click to Download</p>
          </div>
          <svg className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      </div>
    )
  }

  // ── Special: Child weblet tool — shows agent activity + response ──
  if (isChildWeblet) {
    const toolCallCount = childExec?.toolCalls?.length || 0
    const duration = childExec?.durationMs ? formatDuration(childExec.durationMs) : null

    // Check if any child tool call returned __mcp_auth_required — surface inline auth prompt
    const mcpAuthRequired = childExec?.toolCalls?.find(
      (tc: any) => tc.result && typeof tc.result === "object" && tc.result.__mcp_auth_required
    )?.result as { __mcp_auth_required: boolean; serverId: string; serverLabel: string; catalogId?: string; webletId?: string } | undefined

    if (isLoading) {
      return (
        <div className="my-1.5 py-0.5">
          <span className="text-sm font-medium tool-shimmer">
            {`Using ${childSource || action || label}...${elapsedStr}`}
          </span>
        </div>
      )
    }

    return (
      <div className="my-1.5">
        {/* Header toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 w-full text-left py-1 cursor-pointer"
        >
          <svg
            className={cn(
              "size-3 text-muted-foreground/50 transition-transform duration-200 shrink-0",
              open && "rotate-90"
            )}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[13px] text-muted-foreground/60">
            Used <span className="text-muted-foreground font-medium">{childSource || action}</span>
            {(toolCallCount > 0 || duration) && (
              <span className="text-muted-foreground/40 ml-1.5">
                ({[
                  toolCallCount > 0 ? `${toolCallCount} tool call${toolCallCount > 1 ? "s" : ""}` : null,
                  duration,
                ].filter(Boolean).join(", ")})
              </span>
            )}
          </span>
        </button>

        {/* MCP auth required — surface inline auth prompt from child weblet */}
        {mcpAuthRequired && (
          <div className="ml-5 mt-2">
            <MCPOAuthPrompt
              serverId={mcpAuthRequired.serverId}
              serverLabel={mcpAuthRequired.serverLabel}
              catalogId={mcpAuthRequired.catalogId ?? null}
              webletId={mcpAuthRequired.webletId ?? null}
              onConnected={() => onMCPAuthComplete?.()}
            />
          </div>
        )}

        {/* Expanded detail: tool calls + response + task */}
        <div className={cn(
          "ml-2.5 border-l border-zinc-800 pl-4 space-y-3 mt-1",
          !open && "hidden"
        )}>
          {/* Child's tool calls (collapsed details — images already shown above) */}
          {childExec?.toolCalls && childExec.toolCalls.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Agent Tool Calls</span>
              {childExec.toolCalls.map((tc: any, idx: number) => (
                <ChildToolCallItem key={idx} toolCall={tc} />
              ))}
            </div>
          )}

          {/* Child's response */}
          {childResponse && (
            <div>
              <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Agent Response</span>
              <div className="mt-1.5 text-sm prose prose-sm prose-invert max-w-none rounded-lg bg-zinc-900/50 border border-zinc-800/50 px-3 py-2.5">
                <ChatMarkdown content={childResponse} />
              </div>
            </div>
          )}

          {/* Input message sent to child */}
          {input?.message && (
            <div>
              <span className="text-[11px] text-zinc-600 uppercase tracking-wider">Task Given</span>
              <pre className="mt-1 text-[12px] leading-relaxed text-zinc-400 whitespace-pre-wrap break-all font-mono bg-zinc-900/50 rounded px-2.5 py-2 border border-zinc-800/50">
                {input.message}
              </pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Loading state: Claude-style shimmer + pulsing dot ──
  if (isLoading) {
    return (
      <div className="my-1.5 py-0.5" data-tool-state="loading">
        <span className="text-sm font-medium tool-shimmer">
          {action ? `${action}...${elapsedStr}` : `${label}...${elapsedStr}`}
        </span>
      </div>
    )
  }

  // ── Done state: ChatGPT-style checkmark ──
  return (
    <div className="my-1 py-0.5 flex items-center gap-1.5" data-tool-state="done">
      <svg className="size-3.5 text-muted-foreground/70 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8.5L6.5 12L13 4" />
      </svg>
      <span className="text-[13px] text-muted-foreground/70">
        {actionDesc}
      </span>
    </div>
  )
}

/** Individual tool call made by the child weblet — collapsible, supports recursive nesting */
function ChildToolCallItem({ toolCall, depth = 0 }: {
  toolCall: { toolName: string; args: Record<string, any>; result: any }
  depth?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const { label, action } = formatToolName(toolCall.toolName)
  const displayName = action || label
  const hasDetails = (toolCall.args && Object.keys(toolCall.args).length > 0) || toolCall.result != null

  const resultData = toolCall.result && typeof toolCall.result === "object" ? toolCall.result : null

  const isNestedWeblet = toolCall.toolName.startsWith("weblet_") &&
    resultData?._childExecution && depth < 3

  return (
    <div>
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 py-0.5 text-left w-full",
          hasDetails ? "cursor-pointer" : "cursor-default"
        )}
      >
        <svg className="size-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
        <span className="text-[12px] text-zinc-400">
          {displayName}
          {label !== displayName && <span className="text-zinc-600 ml-1">({label})</span>}
        </span>
        {hasDetails && (
          <svg
            className={cn(
              "size-2.5 text-zinc-600 transition-transform duration-150 shrink-0 ml-auto",
              expanded && "rotate-90"
            )}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      {expanded && (
        <div className="ml-5 mt-1 space-y-1.5 pb-1">
          {isNestedWeblet ? (
            <div className="border-l border-zinc-700 pl-3 space-y-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                Sub-agent: {resultData.source || displayName}
              </span>
              {resultData._childExecution?.toolCalls?.map((ntc: any, idx: number) => (
                <ChildToolCallItem key={idx} toolCall={ntc} depth={depth + 1} />
              ))}
              {resultData.response && (
                <div className="text-[12px] text-zinc-400 bg-zinc-900/40 rounded px-2.5 py-2 border border-zinc-800/40">
                  {resultData.response.slice(0, 400)}{resultData.response.length > 400 ? "..." : ""}
                </div>
              )}
            </div>
          ) : (
            <>
              {toolCall.args && Object.keys(toolCall.args).length > 0 && (
                <div>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Input</span>
                  <pre className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 whitespace-pre-wrap break-all font-mono bg-zinc-900/40 rounded px-2 py-1.5 border border-zinc-800/40">
                    {JSON.stringify(toolCall.args, null, 2)}
                  </pre>
                </div>
              )}
              {toolCall.result != null && (
                <div>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Output</span>
                  <pre className="mt-0.5 text-[11px] leading-relaxed text-zinc-500 whitespace-pre-wrap break-all font-mono bg-zinc-900/40 rounded px-2 py-1.5 border border-zinc-800/40 max-h-40 overflow-y-auto">
                    {formatResult(toolCall.result)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
