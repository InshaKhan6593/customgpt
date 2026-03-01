"use client"

import type { MCPToolDef } from "@/lib/mcp/config"

type MCPToolBrowserProps = {
    tools: MCPToolDef[]
}

export function MCPToolBrowser({ tools }: MCPToolBrowserProps) {
    if (tools.length === 0) {
        return (
            <div className="py-3">
                <p className="text-xs text-muted-foreground">
                    No tools discovered. Click refresh to discover tools from this server.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-1">
            <span className="text-xs text-muted-foreground">
                {tools.length} tool{tools.length !== 1 ? "s" : ""} available
            </span>

            <div className="space-y-px">
                {tools.map((tool, index) => (
                    <div
                        key={tool.name || index}
                        className="flex items-start gap-2.5 py-1.5"
                    >
                        <svg className="size-3 text-muted-foreground shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="3" fill="currentColor" />
                        </svg>
                        <div className="min-w-0 flex-1">
                            <span className="text-xs text-foreground font-mono">
                                {tool.name}
                            </span>
                            {tool.description && (
                                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                                    {tool.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
