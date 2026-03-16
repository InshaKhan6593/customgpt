"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Bot,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { ChatContainer } from "@/components/chat/chat-container"
import { UIMessage } from "ai"
import { cn } from "@/lib/utils"

type SessionItem = {
  id: string
  title: string | null
  updatedAt: string
  messageCount: number
  lastMessage: {
    content: string
    role: string
    createdAt: string
  } | null
}

type UserWebletItem = {
  id: string
  addedAt: string
  weblet: {
    id: string
    name: string
    slug: string
    iconUrl: string | null
    conversationStarters: string[] | null
  }
  sessions: SessionItem[]
}

type ActiveSession = {
  id: string
  title: string | null
  weblet: {
    id: string
    name: string
    slug: string
    iconUrl: string | null
  }
  messages: Array<{
    id: string
    role: string
    content: string
    createdAt: string
  }>
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } else if (diffDays === 1) {
    return "Yesterday"
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" })
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }
}

function getTimeGroup(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return "Previous 7 Days"
  if (diffDays < 30) return "This Month"
  return "Older"
}

function truncateMessage(content: string, maxLen = 40): string {
  if (!content) return ""
  const clean = content
    .replace(/\n/g, " ")
    .replace(/^#{1,6}\s+/gm, "")      // strip markdown headings (## Hello → Hello)
    .replace(/\*\*(.+?)\*\*/g, "$1")   // strip bold **text** → text
    .replace(/\*(.+?)\*/g, "$1")       // strip italic *text* → text
    .replace(/__(.+?)__/g, "$1")       // strip bold __text__ → text
    .replace(/_(.+?)_/g, "$1")         // strip italic _text_ → text
    .replace(/`(.+?)`/g, "$1")         // strip inline code
    .replace(/^\s*[-*+]\s+/gm, "")     // strip list markers
    .replace(/^\s*>\s+/gm, "")         // strip blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip links [text](url) → text
    .replace(/\s+/g, " ")
    .trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean
}

export function MyChatsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setOpenMobile } = useSidebar()
  const activeWebletId = searchParams.get("w")
  const activeSessionId = searchParams.get("s")
  const addWebletId = searchParams.get("add")

  const [weblets, setWeblets] = useState<UserWebletItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [activeWeblet, setActiveWeblet] = useState<{
    id: string; name: string; slug: string; iconUrl: string | null
  } | null>(null)
  const [newChatMode, setNewChatMode] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)

  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState("")

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    webletId: string
    sessionId: string
    label: string
  }>({ open: false, webletId: "", sessionId: "", label: "" })

  const sessionCache = useRef<Map<string, ActiveSession>>(new Map())

  // Track programmatic navigation so the URL-watching effect doesn't override it
  const skipNextUrlEffect = useRef(false)

  // Fetch weblets only once on mount — session is loaded separately via URL effect
  useEffect(() => {
    let cancelled = false
    const initialSessionId = activeSessionId

    ;(async () => {
      try {
        const promises: Promise<Response>[] = [fetch("/api/user-weblets", { cache: "no-store" })]
        if (initialSessionId) {
          promises.push(fetch(`/api/chat/sessions/${initialSessionId}`))
        }

        const results = await Promise.all(promises)
        if (cancelled) return

        const webletsRes = results[0]
        if (!webletsRes.ok) throw new Error("Failed to load weblets")
        const data: UserWebletItem[] = await webletsRes.json()
        setWeblets(data)

        if (results[1]?.ok) {
          const sessionData: ActiveSession = await results[1].json()
          sessionCache.current.set(sessionData.id, sessionData)
          setActiveSession(sessionData)
          setActiveWeblet(sessionData.weblet)
        }
      } catch {
        if (!cancelled) toast.error("Failed to load weblets")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle ?add= param (from marketplace direct link)
  useEffect(() => {
    if (!addWebletId || loading) return
    ;(async () => {
      try {
        const res = await fetch("/api/user-weblets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webletId: addWebletId }),
        })
        if (res.ok) {
          const added: UserWebletItem = await res.json()
          setWeblets((prev) => {
            if (prev.some((w) => w.weblet.id === added.weblet.id)) return prev
            return [added, ...prev]
          })
        }
      } catch { /* ignore */ }
      router.replace(`/chats?w=${addWebletId}`, { scroll: false })
    })()
  }, [addWebletId, loading, router])

  // Load session from URL params
  useEffect(() => {
    if (loading) return

    if (skipNextUrlEffect.current) {
      skipNextUrlEffect.current = false
      return
    }

    if (activeSessionId && !activeSession && !loadingSession) {
      loadSession(activeSessionId)
    } else if (activeWebletId && !activeSessionId) {
      if (newChatMode) return

      const uw = weblets.find((w) => w.weblet.id === activeWebletId)
      if (uw) {
        setActiveWeblet(uw.weblet)
        setActiveSession(null)
        setNewChatMode(true)
      } else {
        ;(async () => {
          try {
            const res = await fetch("/api/user-weblets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ webletId: activeWebletId }),
            })
            if (res.ok) {
              const added: UserWebletItem = await res.json()
              setWeblets((prev) => {
                if (prev.some((w) => w.weblet.id === added.weblet.id)) return prev
                return [added, ...prev]
              })
              setActiveWeblet(added.weblet)
              setActiveSession(null)
              setNewChatMode(true)
            }
          } catch { /* ignore */ }
        })()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeWebletId, loading, weblets])

  const loadSession = useCallback(async (sessionId: string) => {
    setNewChatMode(false)

    const cached = sessionCache.current.get(sessionId)
    if (cached) {
      setActiveSession(cached)
      setActiveWeblet(cached.weblet)
      setOpenMobile(false)
      return
    }

    setLoadingSession(true)
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`)
      if (!res.ok) throw new Error("Failed to load chat")
      const data: ActiveSession = await res.json()
      sessionCache.current.set(sessionId, data)
      setActiveSession(data)
      setActiveWeblet(data.weblet)
      setOpenMobile(false)
    } catch {
      toast.error("Failed to load chat messages")
    } finally {
      setLoadingSession(false)
    }
  }, [setOpenMobile])

  const handleSelectSession = (webletId: string, session: SessionItem) => {
    router.push(`/chats?w=${webletId}&s=${session.id}`, { scroll: false })
    loadSession(session.id)
  }

  const handleNewChat = (weblet: { id: string; name: string; slug: string; iconUrl: string | null }) => {
    skipNextUrlEffect.current = true
    router.push(`/chats?w=${weblet.id}`, { scroll: false })
    setActiveWeblet(weblet)
    setActiveSession(null)
    setNewChatMode(true)
    setOpenMobile(false)
  }

  const handleRemoveWeblet = async (webletId: string) => {
    try {
      const res = await fetch(`/api/user-weblets/${webletId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to remove")
      toast.success("Weblet removed")
      setWeblets((prev) => prev.filter((w) => w.weblet.id !== webletId))
      if (activeWeblet?.id === webletId) {
        setActiveSession(null)
        setActiveWeblet(null)
        setNewChatMode(false)
        router.push("/chats", { scroll: false })
      }
    } catch {
      toast.error("Could not remove weblet")
    }
  }

  const handleSessionCreated = useCallback((webletId: string, sessionId: string) => {
    skipNextUrlEffect.current = true
    router.replace(`/chats?w=${webletId}&s=${sessionId}`, { scroll: false })

    setWeblets((prev) => prev.map((w) => {
      if (w.weblet.id !== webletId) return w
      if (w.sessions.some((s) => s.id === sessionId)) return w
      const newSession: SessionItem = {
        id: sessionId,
        title: "New Conversation",
        updatedAt: new Date().toISOString(),
        messageCount: 0,
        lastMessage: null,
      }
      return { ...w, sessions: [newSession, ...w.sessions] }
    }))
  }, [router])

  const confirmDeleteSession = async () => {
    const { webletId, sessionId } = deleteDialog
    if (!sessionId) return

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Chat deleted")
      sessionCache.current.delete(sessionId)
      setWeblets((prev) =>
        prev.map((w) =>
          w.weblet.id === webletId
            ? { ...w, sessions: w.sessions.filter((s) => s.id !== sessionId) }
            : w
        )
      )
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setNewChatMode(true)
        setActiveWeblet(
          weblets.find((w) => w.weblet.id === webletId)?.weblet ?? activeWeblet
        )
        skipNextUrlEffect.current = true
        router.push(`/chats?w=${webletId}`, { scroll: false })
      }
    } catch {
      toast.error("Could not delete chat")
    } finally {
      setDeleteDialog({ open: false, webletId: "", sessionId: "", label: "" })
    }
  }

  const allSessions = weblets.flatMap(uw => 
    uw.sessions.map(session => ({
      ...session,
      weblet: uw.weblet,
    }))
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const filteredSessions = allSessions.filter((session) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (session.title && session.title.toLowerCase().includes(q)) return true
    if (session.lastMessage?.content?.toLowerCase().includes(q)) return true
    if (session.weblet.name.toLowerCase().includes(q)) return true
    return false
  })

  const groupedSessions = filteredSessions.reduce((acc, session) => {
    const group = getTimeGroup(session.updatedAt)
    if (!acc[group]) acc[group] = []
    acc[group].push(session)
    return acc
  }, {} as Record<string, typeof filteredSessions>)

  const timeGroups = ["Today", "Yesterday", "Previous 7 Days", "This Month", "Older"]

  const initialMessages: UIMessage[] = activeSession
    ? activeSession.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        parts: [{ type: "text" as const, text: m.content }],
      }))
    : []

  const conversationStarters: string[] = (() => {
    if (!activeWeblet) return []
    const uw = weblets.find((w) => w.weblet.id === activeWeblet.id)
    const raw = uw?.weblet.conversationStarters
    if (!raw) return []
    if (Array.isArray(raw)) return raw as string[]
    return []
  })()

  const showChat = activeSession || (newChatMode && activeWeblet)

  return (
    <>
      <Sidebar collapsible="offcanvas" className="border-r top-14! h-[calc(100svh-3.5rem)]!">
        <SidebarHeader className="gap-3.5 border-b px-4 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">My Chats</span>
            
            <Popover open={newChatOpen} onOpenChange={setNewChatOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2 shadow-lg" sideOffset={8}>
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="text-xs font-medium text-muted-foreground">Start new chat</span>
                </div>
                
                {weblets.length > 5 && (
                  <div className="px-1 pb-2">
                    <input
                      placeholder="Search weblets..."
                      className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={newChatSearch}
                      onChange={(e) => setNewChatSearch(e.target.value)}
                    />
                  </div>
                )}

                <div className="max-h-[300px] overflow-y-auto space-y-1">
                  {weblets
                    .filter(w => !newChatSearch || w.weblet.name.toLowerCase().includes(newChatSearch.toLowerCase()))
                    .map(w => (
                    <div key={w.weblet.id} className="flex items-center group relative rounded-md hover:bg-accent hover:text-accent-foreground">
                      <button
                        onClick={() => {
                          handleNewChat(w.weblet)
                          setNewChatOpen(false)
                        }}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer outline-hidden pr-8 text-left"
                      >
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={w.weblet.iconUrl || undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/10">
                            {w.weblet.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{w.weblet.name}</span>
                      </button>
                      <button 
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity rounded-md hover:bg-background/50"
                        title="Remove Weblet"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          handleRemoveWeblet(w.weblet.id)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {weblets.filter(w => !newChatSearch || w.weblet.name.toLowerCase().includes(newChatSearch.toLowerCase())).length === 0 && (
                    <div className="py-4 px-2 text-center text-xs text-muted-foreground">
                      No weblets found
                    </div>
                  )}
                </div>
                
                <div className="h-px bg-border my-1 mx-1" />
                
                <button 
                  onClick={() => {
                    router.push("/marketplace")
                    setNewChatOpen(false)
                  }}
                  className="flex w-full items-center px-2 py-1.5 text-sm cursor-pointer outline-hidden rounded-md hover:bg-accent text-primary focus:text-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Browse Marketplace
                </button>
              </PopoverContent>
            </Popover>
          </div>
          <SidebarInput
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              {loading ? (
                <SidebarMenu>
                  {[65, 50, 80, 55, 70].map((w, i) => (
                    <SidebarMenuItem key={i}>
                      <div className="flex h-12 items-center gap-3 rounded-md px-2">
                        <Skeleton className="h-8 flex-1" />
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              ) : allSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <Bot className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  {weblets.length === 0 ? (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        No weblets yet
                      </p>
                      <p className="text-xs text-muted-foreground/70 mb-3">
                        Browse the marketplace to add weblets
                      </p>
                      <Button size="sm" onClick={() => router.push("/marketplace")}>
                        Browse Marketplace
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        No chats yet
                      </p>
                      <p className="text-xs text-muted-foreground/70 mb-3">
                        Start a new conversation
                      </p>
                      <Button size="sm" onClick={() => setNewChatOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        New Chat
                      </Button>
                    </>
                  )}
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No chats match &quot;{search}&quot;
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-6 py-2">
                  {timeGroups.map(group => {
                    const sessionsInGroup = groupedSessions[group]
                    if (!sessionsInGroup || sessionsInGroup.length === 0) return null

                    return (
                      <SidebarGroup key={group} className="p-0">
                        <div className="px-4 text-xs font-medium text-muted-foreground mb-2">
                          {group}
                        </div>
                        <SidebarMenu>
                          {sessionsInGroup.map(session => {
                            const isActive = activeSession?.id === session.id
                            const label = session.lastMessage
                                  ? truncateMessage(session.lastMessage.content, 40)
                                  : session.title && session.title !== "New Conversation"
                                    ? session.title
                                    : "Empty conversation"
                            
                            const relativeTime = formatTime(session.lastMessage?.createdAt || session.updatedAt)

                            return (
                              <SidebarMenuItem key={session.id} className="group/session-item relative">
                                <SidebarMenuButton
                                  isActive={isActive}
                                  onClick={() => handleSelectSession(session.weblet.id, session)}
                                  className="h-auto py-2.5 items-start pr-8"
                                >
                                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                    <span className="font-medium text-sm truncate w-full">
                                      {label}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Avatar className="h-4 w-4 shrink-0">
                                        <AvatarImage src={session.weblet.iconUrl || undefined} />
                                        <AvatarFallback className="text-[8px] bg-primary/10">
                                          {session.weblet.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="truncate">{session.weblet.name}</span>
                                      <span className="shrink-0 opacity-50">·</span>
                                      <span className="shrink-0">{relativeTime}</span>
                                    </div>
                                  </div>
                                </SidebarMenuButton>
                                <button
                                  className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/session-item:flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted z-10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    setDeleteDialog({
                                      open: true,
                                      webletId: session.weblet.id,
                                      sessionId: session.id,
                                      label: label || "this chat",
                                    })
                                  }}
                                  title="Delete chat"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </SidebarMenuItem>
                            )
                          })}
                        </SidebarMenu>
                      </SidebarGroup>
                    )
                  })}
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        {showChat && activeWeblet ? (
          <>
            <header className="flex h-12 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <SidebarSeparator orientation="vertical" className="mr-2 h-4" />
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={activeWeblet.iconUrl || undefined} />
                  <AvatarFallback className="text-[10px] bg-primary/10">
                    {activeWeblet.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium truncate">{activeWeblet.name}</span>
              </div>
            </header>

            {loadingSession ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="space-y-4 text-center">
                  <Skeleton className="h-10 w-10 rounded-full mx-auto" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                </div>
              </div>
            ) : (
              <ChatContainer
                key={activeSession?.id || `new-${activeWeblet.id}`}
                weblet={{
                  id: activeWeblet.id,
                  name: activeWeblet.name,
                  iconUrl: activeWeblet.iconUrl,
                }}
                session={activeSession ? { id: activeSession.id } : null}
                conversationStarters={conversationStarters}
                initialMessages={initialMessages}
                onNewChat={() => handleNewChat(activeWeblet)}
                onSessionCreated={(sessionId) => handleSessionCreated(activeWeblet.id, sessionId)}
                hideHeader
              />
            )}
          </>
        ) : (
          <>
            <header className="flex h-12 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
            </header>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3 px-4">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary/50" />
                </div>
                <div>
                  <h2 className="text-sm font-medium text-foreground mb-0.5">
                    Select a weblet
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Pick a weblet from the sidebar or add one from the marketplace
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/marketplace")}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Browse Marketplace
                </Button>
              </div>
            </div>
          </>
        )}
      </SidebarInset>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, webletId: "", sessionId: "", label: "" })
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteDialog.label}&quot; and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSession}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
