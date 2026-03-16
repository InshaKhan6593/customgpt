"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar"

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

  const groupedSessions = sessions.reduce((acc, session) => {
    const date = new Date(session.updatedAt).toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(session)
    return acc
  }, {} as Record<string, ChatSession[]>)

  return (
    <Sidebar variant="sidebar" className="border-r">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="New Chat">
              <Link href={`/chat/${webletId}`}>
                <Plus className="h-4 w-4" />
                <span>New Chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent chats
          </p>
        ) : (
          Object.entries(groupedSessions).map(([date, dateSessions]) => (
            <SidebarGroup key={date}>
              <SidebarGroupLabel>{date}</SidebarGroupLabel>
              <SidebarMenu>
                {dateSessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/chat/${webletId}/${session.id}`}
                      tooltip={session.title || "New Chat"}
                    >
                      <Link href={`/chat/${webletId}/${session.id}`}>
                        <MessageSquare className="h-4 w-4" />
                        <span>{session.title || "New Chat"}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      onClick={(e) => handleDelete(e, session.id)}
                      disabled={isDeleting === session.id}
                      title="Delete chat"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>
    </Sidebar>
  )
}
