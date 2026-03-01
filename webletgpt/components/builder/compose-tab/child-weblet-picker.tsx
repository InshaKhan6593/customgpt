"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Search, Puzzle } from "lucide-react"
import { toast } from "sonner"

type SearchResult = {
    id: string
    name: string
    slug: string
    description: string | null
    iconUrl: string | null
    category: string
    developer: { name: string | null }
}

type ChildWebletPickerProps = {
    webletId: string
    existingChildIds: string[]
    onAdded: () => void
}

export function ChildWebletPicker({ webletId, existingChildIds, onAdded }: ChildWebletPickerProps) {
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [addingId, setAddingId] = useState<string | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)

        if (!query.trim()) {
            setResults([])
            return
        }

        debounceRef.current = setTimeout(async () => {
            setIsSearching(true)
            try {
                const res = await fetch(
                    `/api/weblets/search?q=${encodeURIComponent(query)}&exclude=${webletId}`
                )
                if (!res.ok) throw new Error("Search failed")
                const data = await res.json()
                setResults(data.weblets || [])
            } catch {
                console.error("Search failed")
            } finally {
                setIsSearching(false)
            }
        }, 300)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [query, webletId])

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
            setQuery("")
            setResults([])
            onAdded()
        } catch (err: any) {
            toast.error(err.message || "Failed to add child weblet")
        } finally {
            setAddingId(null)
        }
    }

    const existingSet = new Set(existingChildIds)

    return (
        <Card className="border-dashed">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Plus className="size-4" />
                    Add Child Weblet
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search weblets by name..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-8 text-sm"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-2.5 top-2.5 size-3.5 text-muted-foreground animate-spin" />
                    )}
                </div>

                {/* Search Results */}
                {results.length > 0 && (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                        {results.map((result) => {
                            const isAlreadyAdded = existingSet.has(result.id)
                            const isAdding = addingId === result.id

                            return (
                                <div
                                    key={result.id}
                                    className={`
                    flex items-center gap-3 p-2.5 rounded-md border transition-colors
                    ${isAlreadyAdded
                                            ? "bg-muted/30 border-border/50 opacity-60"
                                            : "bg-card hover:bg-accent/50 border-border"
                                        }
                  `}
                                >
                                    <div className="flex items-center justify-center size-8 rounded-md bg-violet-500/10 text-violet-500 shrink-0">
                                        <Puzzle className="size-3.5" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium truncate">{result.name}</span>
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                                {result.category.replace("_", " ")}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {result.description || "No description"}
                                        </p>
                                    </div>

                                    {isAlreadyAdded ? (
                                        <span className="text-xs text-muted-foreground shrink-0">Added</span>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isAdding}
                                            onClick={() => handleAdd(result.id, result.name)}
                                            className="shrink-0 text-xs h-7 px-2.5"
                                        >
                                            {isAdding ? (
                                                <Loader2 className="size-3 animate-spin" />
                                            ) : (
                                                <Plus className="size-3 mr-1" />
                                            )}
                                            {isAdding ? "" : "Add"}
                                        </Button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {query && !isSearching && results.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        No weblets found matching &ldquo;{query}&rdquo;
                    </p>
                )}

                {!query && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                        Search for existing weblets to add as building blocks
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
