"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface ChatSession {
  id: string
  title: string | null
  updatedAt: string
}

interface ChatSidebarProps {
  webletId: string
}

export function ChatSidebar({ webletId }: ChatSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/sessions?webletId=${webletId}`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const data = await res.json()
      setSessions(
        (data.data ?? []).map((s: any) => ({
          id: s.id,
          title: s.title,
          updatedAt: s.updatedAt,
        }))
      )
    } catch {
    } finally {
      setIsLoading(false)
    }
  }, [webletId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    fetchSessions()
  }, [pathname, fetchSessions])

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    setIsDeleting(sessionId)

    setSessions((prev) => prev.filter((s) => s.id !== sessionId))

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        fetchSessions()
        throw new Error("Failed to delete")
      }

      toast.success("Chat deleted")

      if (pathname === `/chat/${webletId}/${sessionId}`) {
        router.push(`/chat/${webletId}`)
      }
    } catch {
      toast.error("Could not delete chat")
    } finally {
      setIsDeleting(null)
    }
  }

  return (
    <div className="w-64 border-r bg-muted/20 flex flex-col h-full hidden md:flex">
      <div className="p-4">
        <Button asChild className="w-full justify-start" variant="default">
          <Link href={`/chat/${webletId}`}>
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Link>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent chats
            </p>
          ) : (
            Object.entries(
              sessions.reduce((acc, session) => {
                const date = new Date(session.updatedAt).toLocaleDateString()
                if (!acc[date]) acc[date] = []
                acc[date].push(session)
                return acc
              }, {} as Record<string, ChatSession[]>)
            ).map(([date, dateSessions]) => (
              <div key={date} className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 px-2 uppercase tracking-wider">
                  {date}
                </h4>
                {dateSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/chat/${webletId}/${session.id}`}
                    className={`group flex items-center justify-between px-2 py-2 rounded-md text-sm transition-colors ${
                      pathname === `/chat/${webletId}/${session.id}`
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center truncate mr-2">
                      <MessageSquare className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                      <span className="truncate">
                        {session.title || "New Chat"}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => handleDelete(e, session.id)}
                      disabled={isDeleting === session.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
