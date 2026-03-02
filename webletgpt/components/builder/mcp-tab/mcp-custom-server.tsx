"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import type { MCPAuthType } from "@/lib/mcp/config"

type MCPCustomServerProps = {
    webletId: string
    onServerAdded: () => void
}

export function MCPCustomServer({ webletId, onServerAdded }: MCPCustomServerProps) {
    const [serverUrl, setServerUrl] = useState("")
    const [label, setLabel] = useState("")
    const [description, setDescription] = useState("")
    const [authType, setAuthType] = useState<MCPAuthType>("NONE")
    const [authToken, setAuthToken] = useState("")
    const [requiresUserAuth, setRequiresUserAuth] = useState(false)
    const [isAdding, setIsAdding] = useState(false)

    const handleDiscover = async () => {
        if (!serverUrl.trim()) {
            toast.error("Server URL is required")
            return
        }
        if (!label.trim()) {
            toast.error("Server label is required")
            return
        }

        setIsAdding(true)
        try {
            const res = await fetch(`/api/weblets/${webletId}/mcp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverUrl: serverUrl.trim(),
                    label: label.trim(),
                    description: description.trim() || null,
                    authType,
                    authToken: authToken.trim() || null,
                    requiresUserAuth,
                }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "Failed to add server" }))
                throw new Error(data.error || "Failed to add server")
            }

            const { server } = await res.json()

            // Try to discover tools in the background (non-blocking)
            try {
                const discoverRes = await fetch("/api/mcp/discover", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ serverId: server.id, webletId }),
                })
                if (discoverRes.ok) {
                    toast.success(`${label} added — tools discovered`)
                } else {
                    toast.success(`${label} added (tool discovery failed — you can retry later)`)
                }
            } catch {
                toast.success(`${label} added (tool discovery skipped)`)
            }

            setServerUrl("")
            setLabel("")
            setDescription("")
            setAuthType("NONE")
            setAuthToken("")
            setRequiresUserAuth(false)
            onServerAdded()
        } catch (err: any) {
            toast.error(err.message || "Failed to add MCP server")
        } finally {
            setIsAdding(false)
        }
    }

    return (
        <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Add Custom Server
            </h3>

            <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="server-url" className="text-xs">Server URL</Label>
                        <Input
                            id="server-url"
                            placeholder="https://mcp.example.com/sse"
                            value={serverUrl}
                            onChange={(e) => setServerUrl(e.target.value)}
                            className="text-sm"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="server-label" className="text-xs">Label</Label>
                        <Input
                            id="server-label"
                            placeholder="My Custom Server"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="server-description" className="text-xs">Description (optional)</Label>
                    <Input
                        id="server-description"
                        placeholder="What does this MCP server do?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="text-sm"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="auth-type" className="text-xs">Authentication</Label>
                        <Select value={authType} onValueChange={(val) => setAuthType(val as MCPAuthType)}>
                            <SelectTrigger id="auth-type" className="text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">None</SelectItem>
                                <SelectItem value="API_KEY">API Key</SelectItem>
                                <SelectItem value="BEARER_TOKEN">Bearer Token</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {authType !== "NONE" && (
                        <div className="space-y-1.5">
                            <Label htmlFor="auth-token" className="text-xs">
                                {authType === "API_KEY" ? "API Key" : "Token"}
                            </Label>
                            <Input
                                id="auth-token"
                                type="password"
                                placeholder={authType === "API_KEY" ? "sk-..." : "Bearer token"}
                                value={authToken}
                                onChange={(e) => setAuthToken(e.target.value)}
                                className="text-sm"
                            />
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                        <Label className="text-xs font-medium">Require User Authentication</Label>
                        <p className="text-[11px] text-muted-foreground">
                            Users will be prompted to enter their own token in the chat.
                        </p>
                    </div>
                    <Switch
                        checked={requiresUserAuth}
                        onCheckedChange={setRequiresUserAuth}
                    />
                </div>

                <Button
                    onClick={handleDiscover}
                    disabled={isAdding || !serverUrl.trim() || !label.trim()}
                    className="w-full"
                    size="sm"
                >
                    {isAdding ? (
                        <>
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                            Discovering & Adding...
                        </>
                    ) : (
                        <>
                            <Search className="size-3.5 mr-1.5" />
                            Discover & Add
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
