"use client"

import { useState } from "react"
import { MCP_CATALOG } from "@/lib/mcp/catalog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import {
    Github,
    MessageSquare,
    FolderOpen,
    BookOpen,
    Palette,
    Database,
    CreditCard,
    BarChart3,
    Search,
    HardDrive,
} from "lucide-react"
import type { ConnectedMCPServer } from "@/lib/mcp/config"

// Icon mapping for catalog entries
const CATALOG_ICONS: Record<string, React.ElementType> = {
    github: Github,
    slack: MessageSquare,
    "google-drive": FolderOpen,
    notion: BookOpen,
    figma: Palette,
    supabase: Database,
    stripe: CreditCard,
    linear: BarChart3,
    "brave-search": Search,
    postgres: HardDrive,
}

// Category display labels
const CATEGORY_LABELS: Record<string, string> = {
    developer: "Developer",
    communication: "Communication",
    productivity: "Productivity",
    design: "Design",
    database: "Database",
    search: "Search",
    payments: "Payments",
    project_management: "PM",
}

type MCPCatalogProps = {
    webletId: string
    connectedServers: ConnectedMCPServer[]
    onServerAdded: () => void
}

export function MCPCatalog({ webletId, connectedServers, onServerAdded }: MCPCatalogProps) {
    const [connectingId, setConnectingId] = useState<string | null>(null)

    const connectedCatalogIds = new Set(
        connectedServers
            .filter((s) => s.catalogId)
            .map((s) => s.catalogId)
    )

    const handleConnect = async (catalogId: string) => {
        const entry = MCP_CATALOG.find((e) => e.id === catalogId)
        if (!entry) return

        // PostgreSQL needs custom URL — skip instant connect
        if (!entry.serverUrl) {
            toast.info("This integration requires a custom server URL. Use the form below.")
            return
        }

        setConnectingId(catalogId)
        try {
            const res = await fetch(`/api/weblets/${webletId}/mcp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverUrl: entry.serverUrl,
                    label: entry.name,
                    description: entry.description,
                    authType: entry.authType,
                    catalogId: entry.id,
                    iconUrl: entry.iconUrl,
                }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "Failed to connect" }))
                throw new Error(data.error || "Failed to connect")
            }

            toast.success(`${entry.name} connected`)
            onServerAdded()
        } catch (err: any) {
            toast.error(err.message || "Failed to connect")
        } finally {
            setConnectingId(null)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Popular Integrations</h3>
                <span className="text-xs text-muted-foreground">{MCP_CATALOG.length} available</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {MCP_CATALOG.map((entry) => {
                    const Icon = CATALOG_ICONS[entry.id] || Database
                    const isConnected = connectedCatalogIds.has(entry.id)
                    const isConnecting = connectingId === entry.id

                    return (
                        <div
                            key={entry.id}
                            className={`
                flex items-center gap-3 p-3 rounded-lg border transition-colors
                ${isConnected
                                    ? "bg-emerald-500/5 border-emerald-500/20"
                                    : "bg-card hover:bg-accent/50 border-border"
                                }
              `}
                        >
                            <div className={`
                flex items-center justify-center size-9 rounded-md shrink-0
                ${isConnected ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}
              `}>
                                <Icon className="size-4.5" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium truncate">{entry.name}</span>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                        {CATEGORY_LABELS[entry.category] || entry.category}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {entry.description}
                                </p>
                            </div>

                            {isConnected ? (
                                <div className="flex items-center gap-1 text-emerald-500 shrink-0">
                                    <Check className="size-3.5" />
                                    <span className="text-xs font-medium">Connected</span>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isConnecting}
                                    onClick={() => handleConnect(entry.id)}
                                    className="shrink-0 text-xs h-7 px-2.5"
                                >
                                    {isConnecting ? (
                                        <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                        "Connect"
                                    )}
                                </Button>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
