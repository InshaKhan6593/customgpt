"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KeyRound, ExternalLink, Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

type MCPOAuthPromptProps = {
    serverId: string
    serverLabel: string
    catalogId: string | null
    webletId: string | null
    onConnected: () => void
}

/**
 * Inline OAuth/PAT prompt rendered inside the chat message stream
 * when an MCP tool returns __mcp_auth_required.
 *
 * - For OAuth-capable servers (catalogId matches a provider): shows "Connect" button → opens popup
 * - For non-OAuth servers: shows inline PAT input field
 */
export function MCPOAuthPrompt({
    serverId,
    serverLabel,
    catalogId,
    webletId,
    onConnected,
}: MCPOAuthPromptProps) {
    const [isConnecting, setIsConnecting] = useState(false)
    const [isConnected, setIsConnected] = useState(false)
    const [showPATInput, setShowPATInput] = useState(false)
    const [token, setToken] = useState("")
    const [isSavingToken, setIsSavingToken] = useState(false)

    const isOAuthCapable = !!catalogId

    const handleOAuthConnect = async () => {
        setIsConnecting(true)
        try {
            const res = await fetch("/api/mcp/oauth/authorize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, webletId }),
            })

            if (!res.ok) {
                const data = await res.json()
                // If no OAuth provider configured, fall back to PAT input
                if (res.status === 400 || res.status === 500) {
                    setShowPATInput(true)
                    setIsConnecting(false)
                    return
                }
                throw new Error(data.error || "Failed to start OAuth")
            }

            const { authorizationUrl } = await res.json()

            // Open OAuth popup
            const popup = window.open(
                authorizationUrl,
                "mcp-oauth",
                "popup,width=600,height=700,left=200,top=100"
            )

            // Listen for completion message from popup
            const handler = (event: MessageEvent) => {
                if (event.origin !== window.location.origin) return
                if (event.data?.type === "mcp-oauth-complete") {
                    window.removeEventListener("message", handler)
                    setIsConnecting(false)

                    if (event.data.success) {
                        setIsConnected(true)
                        toast.success(`Connected to ${serverLabel}`)
                        onConnected()
                    } else {
                        toast.error(event.data.error || "OAuth failed")
                    }
                }
            }
            window.addEventListener("message", handler)

            // Cleanup if popup is closed without completing
            const checkClosed = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(checkClosed)
                    window.removeEventListener("message", handler)
                    setIsConnecting(false)
                }
            }, 500)
        } catch (err: any) {
            toast.error(err.message)
            setIsConnecting(false)
        }
    }

    const handlePATSubmit = async () => {
        if (!token.trim()) return
        setIsSavingToken(true)
        try {
            const res = await fetch(`/api/weblets/${webletId}/mcp/user-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serverId, token: token.trim() }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to save token")
            }

            setIsConnected(true)
            toast.success(`Connected to ${serverLabel}`)
            onConnected()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setIsSavingToken(false)
        }
    }

    if (isConnected) {
        return (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-emerald-400">
                    Connected to {serverLabel}. Retrying...
                </span>
            </div>
        )
    }

    // Show PAT input for non-OAuth servers or as fallback
    if (!isOAuthCapable || showPATInput) {
        return (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-amber-400">
                    <KeyRound className="h-4 w-4 shrink-0" />
                    <span>
                        <strong>{serverLabel}</strong> requires authentication to continue
                    </span>
                </div>
                <div className="flex gap-2">
                    <Input
                        type="password"
                        placeholder={`Enter your ${serverLabel} token...`}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") handlePATSubmit()
                        }}
                        className="h-9 text-sm bg-background/50"
                    />
                    <Button
                        size="sm"
                        onClick={handlePATSubmit}
                        disabled={!token.trim() || isSavingToken}
                        className="shrink-0"
                    >
                        {isSavingToken ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            "Connect"
                        )}
                    </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Your token is encrypted and stored securely. It is never shared with the developer.
                </p>
            </div>
        )
    }

    // OAuth-capable server — show connect button
    return (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-400">
                <KeyRound className="h-4 w-4 shrink-0" />
                <span>
                    Connect your <strong>{serverLabel}</strong> account to continue
                </span>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={handleOAuthConnect}
                    disabled={isConnecting}
                    className="gap-2"
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        <>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Connect {serverLabel}
                        </>
                    )}
                </Button>
                <button
                    onClick={() => setShowPATInput(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    Use token instead
                </button>
            </div>
        </div>
    )
}
