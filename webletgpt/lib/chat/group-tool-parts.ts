import type { UIMessage } from "ai"
import { isToolUIPart } from "ai"

/** Tools that always render individually — never grouped */
const SPECIAL_TOOL_NAMES = new Set(["imageGeneration", "codeInterpreter", "presentToUser"])

function isSpecialTool(toolName: string): boolean {
  return SPECIAL_TOOL_NAMES.has(toolName) || toolName.startsWith("weblet_")
}

/** Passthrough for non-tool parts (text, step-start, etc.) */
export type PassthroughPart = {
  type: "passthrough"
  part: UIMessage["parts"][number]
}

/** A single tool part — used for special tools OR single generic tools */
export type ToolSingleGroup = {
  type: "tool-single"
  part: UIMessage["parts"][number]
  toolName: string
  isLoading: boolean
  isDone: boolean
}

/** Multiple consecutive calls to the SAME tool — shown as "Tool Name ×N" */
export type ToolGroupSame = {
  type: "tool-group-same"
  toolName: string
  count: number // always ≥ 2
  parts: UIMessage["parts"]
  isLoading: boolean
  isDone: boolean
}

/** Multiple DIFFERENT tools called in the same step — shown inline with · separator */
export type ToolGroupParallel = {
  type: "tool-group-parallel"
  tools: Array<{ toolName: string; part: UIMessage["parts"][number] }>
  isLoading: boolean
  isDone: boolean
}

export type GroupedToolPart = ToolSingleGroup | ToolGroupSame | ToolGroupParallel

interface AccumulatedTool {
  toolName: string
  isLoading: boolean
  isDone: boolean
  part: UIMessage["parts"][number]
}

/**
 * Groups consecutive tool parts from a message's parts array.
 *
 * Rules:
 * - Special tools (imageGeneration, codeInterpreter, presentToUser, weblet_*) always emit as tool-single
 * - Same tool called consecutively: emit as tool-group-same (count ≥ 2)
 * - Different tools in same state: emit as tool-group-parallel
 * - step-start parts act as grouping boundaries — flush accumulator, emit step-start passthrough
 * - Never mix loading and done states in same group — split into separate groups
 */
export function groupToolParts(
  parts: UIMessage["parts"]
): Array<GroupedToolPart | PassthroughPart> {
  const result: Array<GroupedToolPart | PassthroughPart> = []
  const accumulator: AccumulatedTool[] = []

  for (const part of parts) {
    const partWithType = part as { type?: string }
    const isToolPart = isToolUIPart(part) || partWithType.type?.startsWith("tool-")

    if (!isToolPart) {
      // Flush accumulator before emitting passthrough
      flushAccumulator(accumulator, result)

      // step-start parts act as grouping boundaries
      result.push({
        type: "passthrough",
        part,
      })
      continue
    }

    // This is a tool part
    const p = part as { toolName?: string; state?: string }
    const toolName = p.toolName ?? "tool"
    const state: string = p.state ?? "input-available"

    // Categorize state
    const isLoading =
      state === "input-streaming" ||
      state === "input-available" ||
      state === "call" ||
      state === "partial-call"
    const isDone = state === "output-available" || state === "result" || state === "error"

    // Special tools always emit immediately
    if (isSpecialTool(toolName)) {
      flushAccumulator(accumulator, result)
      result.push({
        type: "tool-single",
        part,
        toolName,
        isLoading,
        isDone,
      })
      continue
    }

    // Generic tool: add to accumulator
    accumulator.push({ toolName, isLoading, isDone, part })
  }

  // Flush remaining accumulator
  flushAccumulator(accumulator, result)

  return result
}

function flushAccumulator(
  accumulator: AccumulatedTool[],
  result: Array<GroupedToolPart | PassthroughPart>
): void {
  if (accumulator.length === 0) {
    return
  }

  if (accumulator.length === 1) {
    // Single tool: emit as tool-single
    const { toolName, isLoading, isDone, part } = accumulator[0]
    result.push({
      type: "tool-single",
      part,
      toolName,
      isLoading,
      isDone,
    })
    accumulator.length = 0
    return
  }

  // Multiple tools: check for same tool + same state
  const firstTool = accumulator[0]
  const allSameTool = accumulator.every((t) => t.toolName === firstTool.toolName)
  const allSameState =
    accumulator.every((t) => t.isLoading === firstTool.isLoading && t.isDone === firstTool.isDone)

  if (allSameTool && allSameState) {
    // All same tool, same state: emit as tool-group-same
    result.push({
      type: "tool-group-same",
      toolName: firstTool.toolName,
      count: accumulator.length,
      parts: accumulator.map((t) => t.part),
      isLoading: firstTool.isLoading,
      isDone: firstTool.isDone,
    })
    accumulator.length = 0
    return
  }

  if (allSameState) {
    // Different tools, same state: emit as tool-group-parallel
    result.push({
      type: "tool-group-parallel",
      tools: accumulator.map((t) => ({ toolName: t.toolName, part: t.part })),
      isLoading: firstTool.isLoading,
      isDone: firstTool.isDone,
    })
    accumulator.length = 0
    return
  }

  // Mixed states: split by state and emit separately
  const loadingTools = accumulator.filter((t) => t.isLoading)
  const doneTools = accumulator.filter((t) => t.isDone)

  if (loadingTools.length > 0) {
    if (loadingTools.length === 1) {
      result.push({
        type: "tool-single",
        part: loadingTools[0].part,
        toolName: loadingTools[0].toolName,
        isLoading: true,
        isDone: false,
      })
    } else {
      const sameToolLoading = loadingTools.every((t) => t.toolName === loadingTools[0].toolName)
      if (sameToolLoading) {
        result.push({
          type: "tool-group-same",
          toolName: loadingTools[0].toolName,
          count: loadingTools.length,
          parts: loadingTools.map((t) => t.part),
          isLoading: true,
          isDone: false,
        })
      } else {
        result.push({
          type: "tool-group-parallel",
          tools: loadingTools.map((t) => ({ toolName: t.toolName, part: t.part })),
          isLoading: true,
          isDone: false,
        })
      }
    }
  }

  if (doneTools.length > 0) {
    if (doneTools.length === 1) {
      result.push({
        type: "tool-single",
        part: doneTools[0].part,
        toolName: doneTools[0].toolName,
        isLoading: false,
        isDone: true,
      })
    } else {
      const sameToolDone = doneTools.every((t) => t.toolName === doneTools[0].toolName)
      if (sameToolDone) {
        result.push({
          type: "tool-group-same",
          toolName: doneTools[0].toolName,
          count: doneTools.length,
          parts: doneTools.map((t) => t.part),
          isLoading: false,
          isDone: true,
        })
      } else {
        result.push({
          type: "tool-group-parallel",
          tools: doneTools.map((t) => ({ toolName: t.toolName, part: t.part })),
          isLoading: false,
          isDone: true,
        })
      }
    }
  }

  accumulator.length = 0
}
