"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  Bot,
  MoreHorizontal,
  Pencil,
  BarChart2,
  ExternalLink,
  Trash2,
  MessageSquare,
  Loader2,
  Globe,
  Lock,
} from "lucide-react"
import { toast } from "sonner"

type Weblet = {
  id: string
  name: string
  slug: string
  description: string | null
  category: string
  isActive: boolean
  isPublic: boolean
  accessType: string
  monthlyPrice: number | null
  createdAt: string
  _count: {
    chatSessions: number
    analyticsEvents: number
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  PRODUCTIVITY: "Productivity",
  EDUCATION: "Education",
  ENTERTAINMENT: "Entertainment",
  RESEARCH: "Research",
  BUSINESS: "Business",
  HEALTH: "Health",
  FINANCE: "Finance",
  TECHNOLOGY: "Technology",
  CREATIVE: "Creative",
  OTHER: "Other",
}

function WebletCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3 flex-1">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t">
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  )
}

export default function MyWebletsPage() {
  const router = useRouter()
  const [weblets, setWeblets] = useState<Weblet[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Weblet | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchWeblets()
  }, [])

  async function fetchWeblets() {
    try {
      const res = await fetch("/api/weblets?limit=100")
      if (!res.ok) throw new Error("Failed to load")
      const json = await res.json()
      setWeblets(json.data || [])
    } catch {
      toast.error("Failed to load weblets")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/weblets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Weblet",
          category: "OTHER",
          prompt: "You are a helpful assistant.",
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create")
      }
      const json = await res.json()
      router.push(`/dashboard/builder/${json.id}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to create weblet")
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/weblets/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success(`"${deleteTarget.name}" has been unpublished`)
      setWeblets((prev) => prev.filter((w) => w.id !== deleteTarget.id))
    } catch {
      toast.error("Failed to delete weblet")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const filtered = weblets.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description || "").toLowerCase().includes(search.toLowerCase()) ||
      w.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Weblets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {loading ? "Loading..." : `${weblets.length} weblet${weblets.length !== 1 ? "s" : ""} created`}
          </p>
        </div>
        <Button variant="secondary" onClick={handleCreate} disabled={creating}>
          {creating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="size-4 mr-2" />
              New Weblet
            </>
          )}
        </Button>
      </div>

      {/* Search */}
      {!loading && weblets.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search weblets..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Weblets Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <WebletCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <Bot className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {search ? "No matching weblets" : "No weblets yet"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              {search
                ? "Try a different search term."
                : "Create your first weblet to get started. It only takes a few minutes."}
            </p>
          </div>
          {!search && (
            <Button variant="secondary" onClick={handleCreate} disabled={creating}>
              {creating ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Plus className="size-4 mr-2" />
              )}
              Create First Weblet
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((weblet) => (
            <Card key={weblet.id} className="flex flex-col group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                    {weblet.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{weblet.name}</span>
                      {/* Actions menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/builder/${weblet.id}`}>
                              <Pencil className="size-4 mr-2" />
                              Edit in Builder
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/weblet/${weblet.id}`}>
                              <BarChart2 className="size-4 mr-2" />
                              View Analytics
                            </Link>
                          </DropdownMenuItem>
                          {weblet.isPublic && (
                            <DropdownMenuItem asChild>
                              <Link href={`/t/${weblet.id}`} target="_blank">
                                <ExternalLink className="size-4 mr-2" />
                                Open Chat
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(weblet)}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Unpublish &amp; Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {weblet.description || "No description yet"}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {CATEGORY_LABELS[weblet.category] || weblet.category}
                  </Badge>
                  {weblet.isPublic ? (
                    <Badge variant="secondary" className="text-xs font-normal gap-1">
                      <Globe className="size-3" />
                      Published
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs font-normal gap-1 text-muted-foreground">
                      <Lock className="size-3" />
                      Draft
                    </Badge>
                  )}
                  {weblet.accessType === "SUBSCRIBERS_ONLY" && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      ${weblet.monthlyPrice}/mo
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {weblet._count.chatSessions.toLocaleString()} chats
                  </span>
                  <span>
                    Created {new Date(weblet.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </CardContent>

              <CardFooter className="pt-3 border-t flex gap-2">
                <Link href={`/dashboard/builder/${weblet.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Pencil className="size-3.5 mr-1.5" />
                    Edit
                  </Button>
                </Link>
                <Link href={`/dashboard/weblet/${weblet.id}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    <BarChart2 className="size-3.5 mr-1.5" />
                    Analytics
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpublish &amp; Remove Weblet</AlertDialogTitle>
            <AlertDialogDescription>
              This will unpublish <span className="font-semibold text-foreground">"{deleteTarget?.name}"</span> and remove it from the marketplace. All chat history and analytics data will be preserved. This action can be reversed by re-publishing from the Builder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />Removing...</>
              ) : (
                "Unpublish & Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
