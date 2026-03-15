"use client"

import { Suspense } from "react"
import { NavHeader } from "@/components/nav-header"
import { MyChatsClient } from "@/components/chats/my-chats-client"

export default function ChatsPage() {
  return (
    <div className="h-svh flex flex-col bg-background">
      <NavHeader />
      <Suspense>
        <MyChatsClient />
      </Suspense>
    </div>
  )
}
