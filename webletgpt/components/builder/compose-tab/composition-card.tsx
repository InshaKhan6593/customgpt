"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Trash2,
    Loader2,
    Puzzle,
} from "lucide-react"
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

type CompositionCardProps = {
    composition: {
        id: string
        childWeblet: {
            id: string
            name: string
            slug: string
            description: string | null
            category: string
            isActive: boolean
        }
        triggerCondition: string | null
    }
    webletId: string
    onUpdate: () => void
}

export function CompositionCard({ composition, webletId, onUpdate }: CompositionCardProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const child = composition.childWeblet

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/weblets/${webletId}/compositions`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ compositionId: composition.id }),
            })
            if (!res.ok) throw new Error("Failed to remove")
            toast.success(`${child.name} removed`)
            onUpdate()
        } catch {
            toast.error("Failed to remove child weblet")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Card>
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="flex items-center justify-center size-9 rounded-md bg-violet-500/10 text-violet-500 shrink-0">
                        <Puzzle className="size-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{child.name}</span>
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                {child.category.replace("_", " ")}
                            </Badge>
                            {!child.isActive && (
                                <Badge variant="destructive" className="text-[10px] px-1 py-0">Inactive</Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground truncate">
                                {child.description || `weblet_${child.slug}`}
                            </span>
                        </div>
                        {composition.triggerCondition && (
                            <span className="text-[11px] text-muted-foreground italic mt-0.5 block">
                                Trigger: {composition.triggerCondition}
                            </span>
                        )}
                    </div>

                    {/* Tool name preview */}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                        weblet_{child.slug}
                    </Badge>

                    {/* Delete */}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive shrink-0"
                                title="Remove child"
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Remove {child.name}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This weblet will no longer be available as a tool during conversations.
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
            </CardContent>
        </Card>
    )
}
