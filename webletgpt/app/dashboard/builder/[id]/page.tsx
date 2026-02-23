"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { BuilderLayout } from "@/components/builder/builder-layout"
import { useRouter } from "next/navigation"
import type { BuilderState } from "@/components/builder/builder-layout"

export default function BuilderStudioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Use React.use() only works in React 19, so we handle it with state
  const [webletId, setWebletId] = useState<string | null>(null)
  const [initialState, setInitialState] = useState<Partial<BuilderState> | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    params.then(({ id }) => {
      setWebletId(id)

      if (id === "new") {
        // New weblet — no data to load
        setLoading(false)
        return
      }

      // Fetch existing weblet data
      fetch(`/api/weblets/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Not found")
          return res.json()
        })
        .then((json) => {
          const w = json
          setInitialState({
            name: w.name || "",
            slug: w.slug || "",
            description: w.description || "",
            iconUrl: w.iconUrl || "",
            category: w.category || "",
            instructions: w.versions?.[0]?.prompt || "",
            model: w.versions?.[0]?.model || "anthropic/claude-3.5-sonnet",
            accessType: w.accessType || "FREE",
            conversationStarters: w.conversationStarters || [],
            privacyPolicy: w.privacyPolicy || "",
            capabilities: w.capabilities || {
              webSearch: false,
              codeInterpreter: false,
              imageGen: false,
              fileSearch: false,
            },
            isActive: w.isActive || false,
          })
          setLoading(false)
        })
        .catch(() => {
          // If weblet not found, redirect back
          router.push("/dashboard/builder")
        })
    })
  }, [params, router])

  if (loading || !webletId) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading builder...</p>
        </div>
      </div>
    )
  }

  return (
    <BuilderLayout
      webletId={webletId}
      initialState={initialState || undefined}
    />
  )
}
