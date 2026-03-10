"use client";

import { X, Copy, Bot, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMarkdown } from "@/components/ui/chat-markdown";
import { useState } from "react";
import type { NodeExecutionState } from "./types";

interface NodeOutputPanelProps {
    nodeId: string;
    nodeName: string;
    nodeIcon: string | null;
    executionState: NodeExecutionState;
    onClose: () => void;
}

export function NodeOutputPanel({
    nodeId,
    nodeName,
    nodeIcon,
    executionState,
    onClose,
}: NodeOutputPanelProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        if (!executionState.output) return;
        await navigator.clipboard.writeText(executionState.output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const output = executionState.output;

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
                <div className="flex items-center gap-2.5">
                    {nodeIcon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={nodeIcon} alt={nodeName} className="w-5 h-5 object-contain" />
                    ) : (
                        <Bot className="w-5 h-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold text-sm tracking-tight">{nodeName} Output</h3>
                </div>

                <div className="flex items-center gap-1">
                    {output && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={handleCopy}
                            title="Copy output"
                        >
                            {copied ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                        onClick={onClose}
                    >
                        <X className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Status Bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10 shrink-0">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</div>
                {executionState.status === "completed" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        Completed
                    </span>
                )}
                {executionState.status === "running" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Running...
                    </span>
                )}
                {executionState.status === "failed" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-[10px] font-medium text-rose-700 dark:text-rose-400">
                        Failed
                    </span>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto min-h-24">
                {/* Tool Calls History */}
                {executionState.toolCalls && executionState.toolCalls.length > 0 && (
                    <div className="border-b bg-muted/5 px-4 py-3 shrink-0">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tools Used</h4>
                        <div className="flex flex-col gap-2">
                            {executionState.toolCalls.map((tool, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-background border text-xs shadow-sm shadow-black/5">
                                    <div className="size-1.5 rounded-full bg-emerald-500" />
                                    <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[220px]">{tool.toolName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Markdown Output */}
                <div className="px-4 py-4">
                    {output ? (
                        <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                            <ChatMarkdown content={output} />
                        </div>
                    ) : executionState.status === "running" ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <span className="size-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="size-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="size-2 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                            <p className="text-xs font-medium uppercase tracking-wider">Agent is thinking...</p>
                        </div>
                    ) : (
                        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic bg-muted/20 border border-dashed rounded-lg mt-2 mx-1">
                            No output generated.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
