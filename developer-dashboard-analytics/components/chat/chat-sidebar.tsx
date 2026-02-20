"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Plus, Trash2, MessageSquare } from "lucide-react"

interface ChatHistory {
  id: string
  title: string
}

interface ChatSidebarProps {
  isOpen: boolean
  history: ChatHistory[]
  onToggle: () => void
  onDeleteChat: (id: string) => void
}

export function ChatSidebar({ isOpen, history, onDeleteChat }: ChatSidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200",
        isOpen ? "w-64" : "w-0 overflow-hidden"
      )}
    >
      <div className="flex items-center justify-between border-b border-border p-3">
        <span className="text-sm font-semibold text-foreground">Chats</span>
        <Button size="sm" asChild>
          <Link href="/chat/new">
            <Plus className="mr-1 h-3 w-3" />
            New Chat
          </Link>
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {history.map((chat) => (
            <div
              key={chat.id}
              className="group relative flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onMouseEnter={() => setHoveredId(chat.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <Link href={`/chat/${chat.id}`} className="flex-1 truncate">
                {chat.title}
              </Link>
              {hoveredId === chat.id && (
                <button
                  onClick={() => onDeleteChat(chat.id)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete chat: ${chat.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  )
}
