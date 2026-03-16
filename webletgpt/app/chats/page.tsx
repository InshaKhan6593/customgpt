"use client"

import { Suspense } from "react"
import { NavHeader } from "@/components/nav-header"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { MyChatsClient } from "@/components/chats/my-chats-client"

export default function ChatsPage() {
  return (
    <div className="h-svh flex flex-col bg-background">
      <NavHeader />
      <SidebarProvider className="flex-1 min-h-0">
        <Suspense>
          <MyChatsClient />
        </Suspense>
      </SidebarProvider>
    </div>
  )
}
