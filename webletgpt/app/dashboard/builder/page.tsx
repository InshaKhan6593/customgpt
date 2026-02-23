"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Bot } from "lucide-react"
import { toast } from "sonner"

export default function BuilderPage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch("/api/weblets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Weblet",
          category: "OTHER",
          prompt: "You are a helpful assistant.",
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to create weblet")
      }
      const json = await res.json()
      router.push(`/dashboard/builder/${json.id}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to create weblet")
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <Bot className="size-8 text-primary" />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Weblet Builder</h1>
        <p className="text-muted-foreground max-w-md mt-2">
          Create powerful AI agents with a visual no-code interface. Configure
          instructions, capabilities, knowledge, and custom actions.
        </p>
      </div>
      <Button onClick={handleCreate} disabled={creating} size="lg">
        {creating ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <Plus className="size-4 mr-2" />
            Create New Weblet
          </>
        )}
      </Button>
    </div>
  )
}
