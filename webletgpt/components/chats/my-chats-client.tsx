"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Bot,
  Search,
  ArrowLeft,
  Plus,
  MoreVertical,
  MessageSquarePlus,
  Trash2,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { ChatContainer } from "@/components/chat/chat-container"
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

function truncateMessage(content: string, maxLen = 35): string {
  if (!content) return ""
  const clean = content.replace(/\n/g, " ").trim()
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean
}

export function MyChatsClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [mobileShowChat, setMobileShowChat] = useState(false)

  // Client-side session cache — avoids re-fetching already-viewed sessions
  const sessionCache = useRef<Map<string, ActiveSession>>(new Map())

  const fetchWeblets = useCallback(async () => {
    try {
      // Fetch weblets and active session in parallel to avoid waterfall
      const promises: Promise<any>[] = [fetch("/api/user-weblets")]
      if (activeSessionId) {
        promises.push(fetch(`/api/chat/sessions/${activeSessionId}`))
      }

      const results = await Promise.all(promises)
      const webletsRes = results[0]

      if (!webletsRes.ok) throw new Error("Failed to load weblets")
      const data: UserWebletItem[] = await webletsRes.json()
      setWeblets(data)

      // If we also fetched the session, load it immediately
      if (results[1]?.ok) {
        const sessionData: ActiveSession = await results[1].json()
        sessionCache.current.set(sessionData.id, sessionData)
        setActiveSession(sessionData)
        setActiveWeblet(sessionData.weblet)
        setMobileShowChat(true)
      }
    } catch {
      toast.error("Failed to load weblets")
    } finally {
      setLoading(false)
    }
  }, [activeSessionId])

  useEffect(() => {
    fetchWeblets()
  }, [fetchWeblets])

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
      // Clean up URL
      router.replace(`/chats?w=${addWebletId}`, { scroll: false })
    })()
  }, [addWebletId, loading, router])

  // Load session from URL params on mount (skip if already loaded in parallel fetch)
  useEffect(() => {
    if (activeSessionId && !activeSession && !loading && !loadingSession) {
      loadSession(activeSessionId)
    } else if (activeWebletId && !activeSessionId && !loading) {
      // Weblet selected but no session — find the weblet and open most recent or new chat
      const uw = weblets.find((w) => w.weblet.id === activeWebletId)
      if (uw) {
        setExpandedWebletId(uw.weblet.id)
        if (uw.sessions.length > 0) {
          loadSession(uw.sessions[0].id)
          router.replace(`/chats?w=${uw.weblet.id}&s=${uw.sessions[0].id}`, { scroll: false })
        } else {
          // New chat mode
          setActiveWeblet(uw.weblet)
          setActiveSession(null)
          setNewChatMode(true)
          setMobileShowChat(true)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeWebletId, loading, weblets])

  const loadSession = useCallback(async (sessionId: string) => {
    setNewChatMode(false)

    // Return cached session instantly if available
    const cached = sessionCache.current.get(sessionId)
    if (cached) {
      setActiveSession(cached)
      setActiveWeblet(cached.weblet)
      setMobileShowChat(true)
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
      setMobileShowChat(true)
    } catch {
      toast.error("Failed to load chat messages")
    } finally {
      setLoadingSession(false)
    }
  }, [])

  const handleSelectWeblet = (uw: UserWebletItem) => {
    setExpandedWebletId((prev) => (prev === uw.weblet.id ? null : uw.weblet.id))

    // Open most recent session, or new chat if no sessions
    if (uw.sessions.length > 0) {
      const mostRecent = uw.sessions[0]
      router.push(`/chats?w=${uw.weblet.id}&s=${mostRecent.id}`, { scroll: false })
      loadSession(mostRecent.id)
    } else {
      router.push(`/chats?w=${uw.weblet.id}`, { scroll: false })
      setActiveWeblet(uw.weblet)
      setActiveSession(null)
      setNewChatMode(true)
      setMobileShowChat(true)
    }
  }

  const handleSelectSession = (webletId: string, session: SessionItem) => {
    router.push(`/chats?w=${webletId}&s=${session.id}`, { scroll: false })
    loadSession(session.id)
  }

  const handleNewChat = (weblet: { id: string; name: string; slug: string; iconUrl: string | null }) => {
    router.push(`/chats?w=${weblet.id}`, { scroll: false })
    setActiveWeblet(weblet)
    setActiveSession(null)
    setNewChatMode(true)
    setMobileShowChat(true)
  }

  const handleRemoveWeblet = async (e: React.MouseEvent, webletId: string) => {
    e.stopPropagation()
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

  const handleDeleteSession = async (e: React.MouseEvent, webletId: string, sessionId: string) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")
      toast.success("Chat deleted")
      // Remove session from local state
      setWeblets((prev) =>
        prev.map((w) =>
          w.weblet.id === webletId
            ? { ...w, sessions: w.sessions.filter((s) => s.id !== sessionId) }
            : w
        )
      )
      // If deleted session was active, clear it
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setNewChatMode(false)
        router.push(`/chats?w=${webletId}`, { scroll: false })
      }
    } catch {
      toast.error("Could not delete chat")
    }
  }

  const handleBackToList = () => {
    setMobileShowChat(false)
    setActiveSession(null)
    setActiveWeblet(null)
    setNewChatMode(false)
    router.push("/chats", { scroll: false })
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
    <div className="flex h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* Left sidebar — weblet list */}
      <div
        className={`w-full md:w-[280px] md:min-w-[260px] md:max-w-[320px] border-r flex flex-col bg-background ${
          mobileShowChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="px-3 py-2.5 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-[13px] font-semibold">My Weblets</h1>
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
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search weblets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-[13px]"
            />
          </div>
        </div>

        {/* Weblet list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
              {weblets.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    No weblets yet
                  </p>
                  <p className="text-xs text-muted-foreground/70 mb-4">
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
            <div className="py-1">
              {filtered.map((uw) => {
                const isExpanded = expandedWebletId === uw.weblet.id
                const isActive = activeWeblet?.id === uw.weblet.id
                const latestTime = uw.sessions[0]?.lastMessage?.createdAt
                  || uw.sessions[0]?.updatedAt
                  || uw.addedAt

                return (
                  <Collapsible
                    key={uw.weblet.id}
                    open={isExpanded}
                    onOpenChange={() => setExpandedWebletId(isExpanded ? null : uw.weblet.id)}
                  >
                    {/* Weblet row */}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors cursor-pointer group ${
                        isActive ? "bg-accent" : ""
                      }`}
                      onClick={() => handleSelectWeblet(uw)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSelectWeblet(uw) }}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={uw.weblet.iconUrl || undefined} />
                        <AvatarFallback className="text-xs font-medium bg-primary/10">
                          {uw.weblet.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[13px] font-medium truncate">
                            {uw.weblet.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0 mr-2">
                            {formatTime(latestTime)}
                          </span>
                        </div>
                        {uw.sessions.length > 0 && uw.sessions[0].lastMessage && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {truncateMessage(uw.sessions[0].lastMessage.content, 35)}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => handleNewChat(uw.weblet)}>
                              <MessageSquarePlus className="h-4 w-4 mr-2" />
                              New Chat
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => handleRemoveWeblet(e, uw.weblet.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {uw.sessions.length > 0 && (
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? "rotate-90" : ""
                                }`}
                              />
                            </Button>
                          </CollapsibleTrigger>
                        )}
                      </div>
                    </div>

                    {/* Expanded session list + New Chat button */}
                    <CollapsibleContent>
                      <div className="pl-1 py-0.5">
                        {uw.sessions.map((session) => (
                          <div
                            key={session.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelectSession(uw.weblet.id, session)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSelectSession(uw.weblet.id, session)
                            }}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent/50 transition-colors cursor-pointer text-[13px] group/session ${
                              activeSession?.id === session.id ? "bg-accent" : ""
                            }`}
                          >
                            <span className="truncate flex-1 min-w-0 text-muted-foreground">
                              {session.lastMessage
                                ? truncateMessage(session.lastMessage.content, 30)
                                : session.title && session.title !== "New Conversation"
                                  ? session.title
                                  : "Empty conversation"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover/session:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteSession(e, uw.weblet.id, session.id) }}
                              title="Delete chat"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right panel — active chat or empty state */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          !mobileShowChat ? "hidden md:flex" : "flex"
        }`}
      >
        {showChat && activeWeblet ? (
          <>
            {/* Mobile back button */}
            <div className="md:hidden absolute top-[3.5rem] left-0 z-20 p-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToList}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>

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
              />
            )}
          </>
        ) : (
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
        )}
      </div>
    </div>
  )
}
