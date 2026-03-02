"use client"

import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { MCPToolBrowser } from "./mcp-tool-browser"
import type { ConnectedMCPServer, MCPToolDef } from "@/lib/mcp/config"

type MCPServerCardProps = {
    server: ConnectedMCPServer
    webletId: string
    onUpdate: () => void
}

export function MCPServerCard({ server, webletId, onUpdate }: MCPServerCardProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isToggling, setIsToggling] = useState(false)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const toolCount = Array.isArray(server.tools) ? server.tools.length : 0

    const handleToggle = async (checked: boolean) => {
        setIsToggling(true)
        try {
            const res = await fetch(`/api/weblets/${webletId}/mcp`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId: server.id, isActive: checked }),
            })
            if (!res.ok) throw new Error("Failed to update")
            onUpdate()
        } catch {
            toast.error("Failed to toggle server")
        } finally {
            setIsToggling(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/weblets/${webletId}/mcp`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId: server.id }),
            })
            if (!res.ok) throw new Error("Failed to remove")
            toast.success(`${server.label} removed`)
            onUpdate()
        } catch {
            toast.error("Failed to remove server")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleRefreshTools = async () => {
        setIsRefreshing(true)
        try {
            const res = await fetch("/api/mcp/discover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId: server.id, webletId }),
            })
            if (!res.ok) throw new Error("Discovery failed")
            toast.success("Tools refreshed")
            onUpdate()
        } catch {
            toast.error("Failed to discover tools")
        } finally {
            setIsRefreshing(false)
        }
    }

    return (
        <div className={`group transition-opacity ${!server.isActive ? "opacity-50" : ""}`}>
            {/* Main row */}
            <div className="flex items-center gap-3 py-3">
                {/* Status dot */}
                <div className={`size-2 rounded-full shrink-0 ${server.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />

                {/* Label + meta */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex-1 min-w-0 text-left"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                            {server.label}
                        </span>
                        {server.catalogId ? (
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">catalog</span>
                        ) : (
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">custom</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate font-mono">
                            {server.serverUrl}
                        </span>
                        {toolCount > 0 && (
                            <span className="text-xs text-muted-foreground shrink-0">
                                · {toolCount} tool{toolCount !== 1 ? "s" : ""}
                            </span>
                        )}
                        {server.requiresUserAuth && (
                            <>
                                <span className="text-xs text-muted-foreground shrink-0">·</span>
                                <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-1.5 rounded uppercase tracking-wider">
                                    Requires User Auth
                                </span>
                            </>
                        )}
                    </div>
                </button>

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-1 shrink-0">
                    {/* Refresh */}
                    <button
                        onClick={handleRefreshTools}
                        disabled={isRefreshing}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                        title="Refresh tools"
                    >
                        {isRefreshing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 2v6h-6" />
                                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                                <path d="M3 22v-6h6" />
                                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                            </svg>
                        )}
                    </button>

                    {/* Toggle */}
                    <Switch
                        checked={server.isActive}
                        onCheckedChange={handleToggle}
                        disabled={isToggling}
                        className="scale-[0.65]"
                    />

                    {/* Expand chevron */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={isExpanded ? "Collapse" : "Show tools"}
                    >
                        <svg
                            className={`size-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>

                    {/* Delete */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove server"
                            >
                                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                </svg>
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Remove {server.label}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will disconnect the MCP server and remove all its tools from this weblet.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                                    {isDeleting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                                    Remove
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Expanded: Tool Browser */}
            {isExpanded && (
                <div className="ml-5 pb-3">
                    <MCPToolBrowser tools={(server.tools as MCPToolDef[]) || []} />
                </div>
            )}
        </div>
    )
}
