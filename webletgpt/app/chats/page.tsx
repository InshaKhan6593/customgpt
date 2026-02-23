"use client"

import { NavHeader } from "@/components/nav-header"


export default function ChatsPage() {
  return (
    <div className="min-h-svh bg-background">
      <NavHeader />
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">My Chats</h1>
        <p className="text-muted-foreground">Your AI chat conversations will appear here.</p>
      </div>
    </div>
  )
}
