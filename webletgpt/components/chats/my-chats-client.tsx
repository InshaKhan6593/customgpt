"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
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
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Bot,
  Plus,
  MoreHorizontal,
  MessageSquarePlus,
  Trash2,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { ChatContainer } from "@/components/chat/chat-container"
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { UIMessage } from "ai"

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

function truncateMessage(content: string, maxLen = 30): string {
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
  const [expandedWebletId, setExpandedWebletId] = useState<string | null>(activeWebletId)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [activeWeblet, setActiveWeblet] = useState<{
    id: string; name: string; slug: string; iconUrl: string | null
  } | null>(null)
  const [newChatMode, setNewChatMode] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)

  // Delete confirmation dialog state
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

  // Load session from URL params — only reacts to external navigation,
  // skips when we programmatically pushed the URL (new chat, delete, etc.)
  useEffect(() => {
    if (loading) return

    // If we flagged a skip (programmatic nav), consume it and do nothing
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
        setExpandedWebletId(uw.weblet.id)
        setActiveWeblet(uw.weblet)
        setActiveSession(null)
        setNewChatMode(true)
      } else {
        // Weblet not in sidebar yet (e.g. just added from marketplace).
        // Add it via API and open new chat.
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
              setExpandedWebletId(added.weblet.id)
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

  const handleSelectWeblet = (uw: UserWebletItem) => {
    const willExpand = expandedWebletId !== uw.weblet.id
    setExpandedWebletId(willExpand ? uw.weblet.id : null)

    skipNextUrlEffect.current = true
    router.push(`/chats?w=${uw.weblet.id}`, { scroll: false })
    setActiveWeblet(uw.weblet)
    setActiveSession(null)
    setNewChatMode(true)
    setOpenMobile(false)
  }

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

  // Called by ChatContainer when a new session is pre-created (ChatGPT-style)
  const handleSessionCreated = useCallback((webletId: string, sessionId: string) => {
    skipNextUrlEffect.current = true
    router.replace(`/chats?w=${webletId}&s=${sessionId}`, { scroll: false })

    // Add new session to sidebar immediately
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

    // Expand this weblet in the sidebar
    setExpandedWebletId(webletId)
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

  // Filter weblets by search
  const filtered = weblets.filter((uw) => {
    if (!search.trim()) return true
    return uw.weblet.name.toLowerCase().includes(search.toLowerCase())
  })

  // Build initial messages for ChatContainer
  const initialMessages: UIMessage[] = activeSession
    ? activeSession.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        parts: [{ type: "text" as const, text: m.content }],
      }))
    : []

  // Parse conversation starters for new chat mode
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
            <span className="text-sm font-semibold text-foreground">My Weblets</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => router.push("/marketplace")}
              title="Add weblet"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <SidebarInput
            placeholder="Search weblets..."
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
                      <div className="flex h-8 items-center gap-2 rounded-md px-2">
                        <Skeleton className="size-4 rounded-md" />
                        <Skeleton className="h-4 flex-1" style={{ maxWidth: `${w}%` }} />
                      </div>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              ) : filtered.length === 0 ? (
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
                    <p className="text-sm text-muted-foreground">
                      No weblets match &quot;{search}&quot;
                    </p>
                  )}
                </div>
              ) : (
                <SidebarMenu>
                  {filtered.map((uw) => {
                    const isExpanded = expandedWebletId === uw.weblet.id
                    const isActive = activeWeblet?.id === uw.weblet.id
                    const hasSessions = uw.sessions.length > 0

                    return (
                      <Collapsible
                        key={uw.weblet.id}
                        open={isExpanded}
                        asChild
                      >
                        <SidebarMenuItem>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => handleSelectWeblet(uw)}
                            tooltip={uw.weblet.name}
                            className="h-auto py-2"
                          >
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage src={uw.weblet.iconUrl || undefined} />
                              <AvatarFallback className="text-[10px] font-medium bg-primary/10">
                                {uw.weblet.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col gap-0.5 leading-none min-w-0 flex-1">
                              <span className="font-medium truncate text-sm">{uw.weblet.name}</span>
                              {hasSessions && uw.sessions[0].lastMessage && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {truncateMessage(uw.sessions[0].lastMessage.content)}
                                </span>
                              )}
                            </div>
                            {hasSessions && (
                              <ChevronRight
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              />
                            )}
                          </SidebarMenuButton>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuAction showOnHover>
                                <MoreHorizontal />
                                <span className="sr-only">More</span>
                              </SidebarMenuAction>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              side="right"
                              align="start"
                              className="w-48"
                            >
                              <DropdownMenuItem onClick={() => handleNewChat(uw.weblet)}>
                                <MessageSquarePlus className="mr-2 h-4 w-4" />
                                New Chat
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleRemoveWeblet(uw.weblet.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {uw.sessions.map((session) => {
                                const label = session.lastMessage
                                  ? truncateMessage(session.lastMessage.content, 22)
                                  : session.title && session.title !== "New Conversation"
                                    ? session.title
                                    : "Empty conversation"

                                return (
                                  <SidebarMenuSubItem key={session.id} className="group/sub-item">
                                    <button
                                      onClick={() => handleSelectSession(uw.weblet.id, session)}
                                      data-active={activeSession?.id === session.id}
                                      className="text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground flex h-7 w-full min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm outline-hidden focus-visible:ring-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                                    >
                                      <span className="truncate flex-1 text-left">
                                        {label}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground shrink-0 group-hover/sub-item:hidden">
                                        {formatTime(session.lastMessage?.createdAt || session.updatedAt)}
                                      </span>
                                      <span
                                        role="button"
                                        tabIndex={-1}
                                        className="hidden group-hover/sub-item:flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setDeleteDialog({
                                            open: true,
                                            webletId: uw.weblet.id,
                                            sessionId: session.id,
                                            label: label || "this chat",
                                          })
                                        }}
                                        title="Delete chat"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </span>
                                    </button>
                                  </SidebarMenuSubItem>
                                )
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )
                  })}
                </SidebarMenu>
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

      {/* Delete chat confirmation dialog */}
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
