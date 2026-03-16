"use client";

import { X, Copy, Bot, CheckCircle2, Download, FileIcon } from "lucide-react";
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
            <div className="flex items-center justify-between px-4 py-3 border-b bg-black shrink-0 text-white">
                <div className="flex items-center gap-2.5">
                    {nodeIcon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={nodeIcon} alt={nodeName} className="w-5 h-5 object-contain" />
                    ) : (
                        <Bot className="w-5 h-5 text-zinc-400" />
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
                            {copied ? <CheckCircle2 className="size-3.5 text-amber-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
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

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto min-h-24">
                {/* Tool Calls History */}
                {executionState.toolCalls && executionState.toolCalls.length > 0 && (
                    <div className="border-b bg-black px-4 py-3 shrink-0">
                        <h4 className="text-xs font-medium text-zinc-400 mb-2.5">Tools Used</h4>
                        <div className="flex flex-wrap gap-2">
                            {Array.from(new Set(executionState.toolCalls.map(t => t.toolName))).map((toolName, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-black border border-zinc-800 text-[11px] font-medium text-white shadow-sm tracking-wide">
                                    <div className="size-1.5 rounded-full bg-amber-500/80" />
                                    <span>{toolName}</span>
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
                        <div className="flex h-32 flex-col items-center justify-center gap-3 bg-black border border-amber-500/20 rounded-sm mt-2 mx-1 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent animate-pulse" />
                            <div className="flex items-center gap-2 relative z-10">
                                <span className="size-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="size-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="size-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                            <span className="text-[11px] uppercase tracking-widest font-medium animate-pulse text-white">Running Agent</span>
                        </div>
                    ) : (
                        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic bg-muted/20 border border-dashed rounded-sm mt-2 mx-1">
                            No output generated.
                        </div>
                    )}
                </div>

                {/* Artifacts */}
                {executionState.toolCalls && (() => {
                  // Extract images and files from tool call results
                  const images: { url: string; name: string }[] = [];
                  const files: { url: string; name: string }[] = [];
                  
                  for (const tc of executionState.toolCalls) {
                    if (tc.toolName === "codeInterpreter" && tc.result?.data) {
                      for (const img of (tc.result.data.images || [])) {
                        images.push({ url: img.url, name: `Chart` });
                      }
                      for (const file of (tc.result.data.files || [])) {
                        files.push({ url: file.url, name: file.name });
                      }
                    }
                    if (tc.toolName === "imageGeneration" && tc.result?.url) {
                      images.push({ url: tc.result.url, name: "Generated Image" });
                    }
                  }

                  if (images.length === 0 && files.length === 0) return null;

                  return (
                    <div className="px-4 py-3 border-t space-y-3">
                      <h4 className="text-xs font-medium text-muted-foreground">Artifacts</h4>
                      {images.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {images.map((img, i) => (
                            <a key={i} href={img.url} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={img.name}
                                className="rounded-lg border border-border/40 max-w-[200px] max-h-[150px] object-contain bg-muted/20 hover:border-primary/40 transition-colors cursor-pointer"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      {files.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {files.map((file, i) => (
                            <a
                              key={i}
                              href={file.url}
                              download={file.name}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border/60 bg-card text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
                            >
                              <FileIcon className="size-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[120px]">{file.name}</span>
                              <Download className="size-3 text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
        </div>
    );
}
