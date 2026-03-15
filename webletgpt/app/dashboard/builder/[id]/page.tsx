"use client"

import { useState, useEffect } from "react"
import { BuilderLayout } from "@/components/builder/builder-layout"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react"
import Link from "next/link"
import type { BuilderState } from "@/components/builder/builder-layout"

type LoadState =
  | { status: "loading" }
  | { status: "ready"; webletId: string; initialState: Partial<BuilderState> | undefined }
  | { status: "new"; webletId: string }
  | { status: "error"; code: number; message: string }

export default function BuilderStudioPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { id } = await params

      if (id === "new") {
        if (!cancelled) setLoadState({ status: "new", webletId: id })
        return
      }

      try {
        const res = await fetch(`/api/builder/${id}`)

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const message =
            res.status === 403
              ? "You don't have permission to edit this weblet."
              : res.status === 404
              ? "This weblet no longer exists."
              : body?.error || "Failed to load weblet. Please try again."
          if (!cancelled) setLoadState({ status: "error", code: res.status, message })
          return
        }

        const w = await res.json()

        if (!cancelled) {
          setLoadState({
            status: "ready",
            webletId: id,
            initialState: {
              name: w.name || "",
              slug: w.slug || "",
              description: w.description || "",
              iconUrl: w.iconUrl || "",
              category: w.category || "",
              instructions: w.versions?.[0]?.prompt || "",
              model: w.versions?.[0]?.model || "anthropic/claude-3.5-sonnet",
              openapiSchema: (() => {
                const s = w.versions?.[0]?.openapiSchema
                if (!s) return ""
                // If Prisma returns a string (old rows stored before the parse fix),
                // use it directly to avoid double-encoding via JSON.stringify.
                if (typeof s === "string") return s
                return JSON.stringify(s, null, 2)
              })(),
              accessType: w.accessType || "FREE",
              monthlyPrice: w.monthlyPrice ?? undefined,
              conversationStarters: w.conversationStarters || [],
              privacyPolicy: w.privacyPolicy || "",
              capabilities: w.capabilities || {
                webSearch: false,
                codeInterpreter: false,
                imageGen: false,
                fileSearch: false,
              },
              isActive: w.isActive ?? false,
              rsilEnabled: w.rsilEnabled ?? false,
            },
          })
        }
      } catch (err) {
        console.error("[BuilderStudioPage] Unexpected error loading weblet:", err)
        if (!cancelled) {
          setLoadState({
            status: "error",
            code: 0,
            message: "An unexpected error occurred. Please refresh and try again.",
          })
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [params])

  if (loadState.status === "loading") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading builder...</p>
        </div>
      </div>
    )
  }

  if (loadState.status === "error") {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col items-center gap-5 text-center max-w-sm">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="size-7 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {loadState.code === 403 ? "Access Denied" : loadState.code === 404 ? "Not Found" : "Error Loading Weblet"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{loadState.message}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard/weblets">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-4 mr-2" />
                My Weblets
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoadState({ status: "loading" })
                window.location.reload()
              }}
            >
              <RefreshCw className="size-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (loadState.status === "new") {
    return <BuilderLayout webletId={loadState.webletId} initialState={undefined} />
  }

  return (
    <BuilderLayout
      webletId={loadState.webletId}
      initialState={loadState.initialState}
    />
  )
}
