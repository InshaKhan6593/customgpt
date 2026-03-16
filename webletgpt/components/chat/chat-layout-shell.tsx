"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { ChatSidebar } from "@/components/chat/chat-sidebar"

interface ChatLayoutShellProps {
  webletId: string
  defaultSidebarOpen: boolean
  children: React.ReactNode
}

export function ChatLayoutShell({ webletId, defaultSidebarOpen, children }: ChatLayoutShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <ChatSidebar webletId={webletId} />
      <SidebarInset className="flex flex-col h-screen min-w-0 flex-1 overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
