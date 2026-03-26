"use client"

import { useState, useEffect, useCallback } from "react"
import { Separator } from "@/components/ui/separator"
import { Loader2, GitBranch } from "lucide-react"
import { ChildWebletPicker } from "./child-weblet-picker"
import { CompositionCard } from "./composition-card"

type Composition = {
    id: string
    parentWebletId: string
    childWebletId: string
    triggerCondition: string | null
    childWeblet: {
        id: string
        name: string
        slug: string
        description: string | null
        iconUrl: string | null
        category: string
        isActive: boolean
    }
}

type ComposeTabProps = {
    webletId: string
}

export function ComposeTab({ webletId }: ComposeTabProps) {
    const [compositions, setCompositions] = useState<Composition[]>([])
    const [isLoading, setIsLoading] = useState(true)

    const fetchCompositions = useCallback(async () => {
        try {
            const res = await fetch(`/api/weblets/${webletId}/compositions`)
            if (!res.ok) throw new Error("Failed to fetch")
            const data = await res.json()
            setCompositions(data.compositions || [])
        } catch (err) {
            console.error("Failed to fetch compositions:", err)
        } finally {
            setIsLoading(false)
        }
    }, [webletId])

    useEffect(() => {
        fetchCompositions()
    }, [fetchCompositions])

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
                    <GitBranch className="size-4" />
                    Weblet Composition
                </h2>
                <p className="text-xs text-muted-foreground">
                    Compose this weblet from other weblets. Child weblets become callable tools —
                    your AI can delegate tasks to specialized weblets during conversations.
                </p>
            </div>

            {/* Connected Children */}
            {compositions.length > 0 && (
                <div className="space-y-1.5">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Child Weblets ({compositions.length})
                    </h3>
                    <div className="space-y-1.5">
                        {compositions.map((comp) => (
                            <CompositionCard
                                key={comp.id}
                                composition={comp}
                                webletId={webletId}
                                onUpdate={fetchCompositions}
                            />
                        ))}
                    </div>
                </div>
            )}

            {compositions.length > 0 && <Separator />}

            {/* Add Child Weblet */}
            <ChildWebletPicker
                webletId={webletId}
                existingChildIds={compositions.map((c) => c.childWebletId)}
                onAdded={fetchCompositions}
            />
        </div>
    )
}
