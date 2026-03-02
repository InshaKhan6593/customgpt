"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, ShieldAlert, Loader2 } from "lucide-react"
import { toast } from "sonner"

export type RequiredMCPServer = {
    id: string
    label: string
    serverUrl: string
    iconUrl: string | null
    description: string | null
    hasToken: boolean
}

type MCPAuthGateProps = {
    webletId: string
    missingServers: RequiredMCPServer[]
    onAuthenticated: () => void
}

export function MCPAuthGate({ webletId, missingServers, onAuthenticated }: MCPAuthGateProps) {
    const [tokens, setTokens] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Using the first missing server as the primary one to show for simplicity,
    // though this supports entering tokens for multiple servers if needed.
    const server = missingServers[0]

    if (!server) return null

    const handleConnect = async () => {
        const token = tokens[server.id]
        if (!token?.trim()) {
            toast.error("Please enter your token")
            return
        }

        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/weblets/${webletId}/mcp/user-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverId: server.id,
                    token: token.trim(),
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to save token")
            }

            toast.success(`Connected to ${server.label}`)
            setTokens((prev) => ({ ...prev, [server.id]: "" }))
            onAuthenticated()
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                        <ShieldAlert className="h-6 w-6" />
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold tracking-tight">
                            Authentication Required
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            This weblet needs access to your <span className="font-medium text-foreground">{server.label}</span> account to function properly.
                        </p>
                    </div>

                    {server.description && (
                        <div className="w-full rounded-md bg-muted/50 p-3 text-xs text-muted-foreground text-left">
                            {server.description}
                        </div>
                    )}

                    <div className="w-full space-y-4 pt-4">
                        <div className="space-y-2 text-left">
                            <Label htmlFor="token-input">Personal Access Token</Label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="token-input"
                                    type="password"
                                    placeholder="Enter your token (e.g., github_pat_...)"
                                    className="pl-9"
                                    value={tokens[server.id] || ""}
                                    onChange={(e) => setTokens((prev) => ({ ...prev, [server.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleConnect()
                                    }}
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Your token will be securely encrypted and stored for your account only. It is never shared with the weblet developer.
                            </p>
                        </div>

                        <Button
                            className="w-full"
                            onClick={handleConnect}
                            disabled={isSubmitting || !tokens[server.id]?.trim()}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                "Connect Account"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
