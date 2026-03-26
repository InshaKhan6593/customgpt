"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertTriangle, ChevronsUpDown, Loader2, Plus, Puzzle, Search } from "lucide-react"
import { toast } from "sonner"

type SearchResult = {
    id: string
    name: string
    slug: string
    description: string | null
    iconUrl: string | null
    category: string
    developer: { name: string | null }
    isOwnedByCurrentUser?: boolean
    isSelectable?: boolean
    disabledReason?: string | null
}

type ChildWebletPickerProps = {
    webletId: string
    existingChildIds: string[]
    onAdded: () => void
}

const normalizeIconUrl = (iconUrl: string | null) => {
    if (!iconUrl) return undefined

    const trimmed = iconUrl.trim()
    if (!trimmed) return undefined

    if (
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("data:") ||
        trimmed.startsWith("blob:")
    ) {
        return trimmed
    }

    if (trimmed.startsWith("//")) {
        return `https:${trimmed}`
    }

    if (trimmed.startsWith("/")) {
        return trimmed
    }

    return `/${trimmed.replace(/^\.?\//, "")}`
}

export function ChildWebletPicker({ webletId, existingChildIds, onAdded }: ChildWebletPickerProps) {
    const [query, setQuery] = useState("")
    const [open, setOpen] = useState(false)
    const [results, setResults] = useState<SearchResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [addingId, setAddingId] = useState<string | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const handleOutside = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener("mousedown", handleOutside)
        return () => {
            document.removeEventListener("mousedown", handleOutside)
        }
    }, [])

    const fetchWeblets = async () => {
        if (!webletId) {
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch(`/api/weblets/search?exclude=${encodeURIComponent(webletId)}&limit=200`)
            if (!res.ok) throw new Error("Search failed")
            const data = await res.json()
            setResults(data.weblets || [])
        } catch {
            toast.error("Failed to load weblets")
        } finally {
            setIsLoading(false)
        }
    }

    const handleFocus = () => {
        setOpen(true)
        if (results.length === 0) {
            void fetchWeblets()
        }
    }

    const handleAdd = async (childId: string, childName: string) => {
        setAddingId(childId)
        try {
            const res = await fetch(`/api/weblets/${webletId}/compositions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ childWebletId: childId }),
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "Failed to add" }))
                throw new Error(data.error || "Failed to add")
            }

            toast.success(`${childName} added as child weblet`)
            onAdded()
            await fetchWeblets()
            setOpen(false)
            setQuery("")
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to add child weblet"
            toast.error(message)
        } finally {
            setAddingId(null)
        }
    }

    const existingSet = new Set(existingChildIds)
    const allAvailableResults = useMemo(
        () => results.filter((result) => !existingSet.has(result.id) && result.id !== webletId && result.slug !== webletId),
        [results, existingChildIds, webletId]
    )

    const filteredResults = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return allAvailableResults

        return allAvailableResults.filter((result) => {
            return (
                result.name.toLowerCase().includes(q) ||
                result.slug.toLowerCase().includes(q) ||
                (result.description?.toLowerCase().includes(q) ?? false)
            )
        })
    }, [allAvailableResults, query])

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Plus className="size-4" />
                    Add Child Weblet
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="relative" ref={containerRef}>
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setOpen(true)
                        }}
                        onFocus={handleFocus}
                        placeholder="Search weblets by name..."
                        className="pl-8 pr-8 text-sm"
                    />
                    <ChevronsUpDown className="absolute right-2.5 top-2.5 size-4 text-muted-foreground opacity-50 pointer-events-none" />

                    {open && (
                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                            {isLoading ? (
                                <div className="py-4 px-3 text-xs text-muted-foreground flex items-center justify-center gap-2">
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Loading weblets...
                                </div>
                            ) : filteredResults.length === 0 ? (
                                <div className="py-4 px-3 text-xs text-muted-foreground text-center">
                                    No available weblets found.
                                </div>
                            ) : (
                                <div className="max-h-72 overflow-y-auto p-1 space-y-1">
                                    {filteredResults.map((result) => {
                                        const isAdding = addingId === result.id
                                        const isSelectable = result.isSelectable !== false
                                        const disabledReason = result.disabledReason || "Not selectable"
                                        const sourceLabel = result.isOwnedByCurrentUser ? "Yours" : "Marketplace"

                                        return (
                                            <Button
                                                key={result.id}
                                                variant="ghost"
                                                onClick={() => {
                                                    if (!isAdding && isSelectable) {
                                                        void handleAdd(result.id, result.name)
                                                    }
                                                }}
                                                disabled={isAdding || !isSelectable}
                                                aria-disabled={!isSelectable}
                                                className="w-full h-auto justify-start p-2 gap-3"
                                            >
                                                <Avatar className="size-8 rounded-md shrink-0">
                                                    <AvatarImage src={normalizeIconUrl(result.iconUrl)} alt={result.name} className="rounded-md object-cover" />
                                                    <AvatarFallback className="rounded-md bg-violet-500/10 text-violet-500">
                                                        <Puzzle className="size-3.5" />
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0 text-left">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-medium truncate">{result.name}</span>
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                                            {result.category.replace("_", " ")}
                                                        </Badge>
                                                        <Badge variant={result.isOwnedByCurrentUser ? "secondary" : "outline"} className="text-[10px] px-1 py-0 shrink-0">
                                                            {sourceLabel}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {result.description || "No description"}
                                                    </p>
                                                    {!result.isOwnedByCurrentUser && result.developer?.name && (
                                                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                            By {result.developer.name}
                                                        </p>
                                                    )}
                                                    {!isSelectable && (
                                                        <p className="text-[11px] text-amber-600 truncate mt-0.5">
                                                            {disabledReason}
                                                        </p>
                                                    )}
                                                </div>

                                                {isAdding ? (
                                                    <Loader2 className="size-3.5 animate-spin shrink-0 text-muted-foreground" />
                                                ) : !isSelectable ? (
                                                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                                                ) : (
                                                    <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                                                )}
                                            </Button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <p className="text-xs text-muted-foreground text-center py-2">
                    Pick from available marketplace weblets not already selected
                </p>
            </CardContent>
        </Card>
    )
}
