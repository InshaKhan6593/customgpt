"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { MCPCustomServer } from "./mcp-custom-server"
import { MCPServerCard } from "./mcp-server-card"
import type { ConnectedMCPServer } from "@/lib/mcp/config"

type MCPTabProps = {
    webletId: string
}

export function MCPTab({ webletId }: MCPTabProps) {
    const [connectedServers, setConnectedServers] = useState<ConnectedMCPServer[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchServers = useCallback(async () => {
        try {
            const res = await fetch(`/api/weblets/${webletId}/mcp`)
            if (!res.ok) throw new Error("Failed to fetch MCP servers")
            const data = await res.json()
            setConnectedServers(data.servers || [])
        } catch (err) {
            console.error("Failed to fetch MCP servers:", err)
        } finally {
            setIsLoading(false)
        }
    }, [webletId])

    useEffect(() => {
        fetchServers()
    }, [fetchServers])

    const handleRefresh = () => {
        fetchServers()
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-1">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
                    </svg>
                    MCP Integrations
                </h2>
                <p className="text-xs text-muted-foreground">
                    Connect external tools via the Model Context Protocol. Your weblet can call these tools during conversations.
                </p>
            </div>

            {/* Connected Servers */}
            {connectedServers.length > 0 && (
                <div>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Connected ({connectedServers.length})
                    </h3>
                    <div className="divide-y divide-zinc-800/50">
                        {connectedServers.map((server) => (
                            <MCPServerCard
                                key={server.id}
                                server={server}
                                webletId={webletId}
                                onUpdate={handleRefresh}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Divider */}
            {connectedServers.length > 0 && (
                <Separator />
            )}

            {/* Custom Server */}
            <MCPCustomServer webletId={webletId} onServerAdded={handleRefresh} />
        </div>
    )
}
