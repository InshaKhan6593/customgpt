"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Trash2,
    Loader2,
    Puzzle,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
            iconUrl: string | null
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
        <div className="rounded-lg border bg-card px-3 py-2.5">
            <div className="flex items-center gap-2.5">
                <Avatar className="size-8 rounded-md shrink-0">
                    <AvatarImage src={child.iconUrl || undefined} alt={child.name} className="rounded-md object-cover" />
                    <AvatarFallback className="rounded-md bg-violet-500/10 text-violet-500">
                        <Puzzle className="size-3.5" />
                    </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate">{child.name}</span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                            {child.category.replace("_", " ")}
                        </Badge>
                        {!child.isActive && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 shrink-0">Inactive</Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {child.description || `weblet_${child.slug}`}
                    </p>
                </div>

                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0 hidden md:inline-flex">
                    weblet_{child.slug}
                </Badge>

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

            {composition.triggerCondition && (
                <p className="text-[11px] text-muted-foreground italic mt-1.5 pl-10">
                    Trigger: {composition.triggerCondition}
                </p>
            )}
        </div>
    )
}
