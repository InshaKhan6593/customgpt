"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

// This page creates a new weblet and redirects to the builder studio.
// For now, it redirects to a placeholder ID. Once wired, it will POST /api/weblets first.
export default function BuilderPage() {
  const router = useRouter()

  useEffect(() => {
    // TODO: POST /api/weblets to create a new weblet, then redirect to /dashboard/builder/[id]
    // For now, show a landing page
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <h1 className="text-3xl font-bold text-foreground">Weblet Builder</h1>
      <p className="text-muted-foreground max-w-md text-center">
        Create powerful AI agents with a visual no-code interface. Configure
        instructions, capabilities, knowledge, and custom actions.
      </p>
      <button
        onClick={async () => {
          // TODO: Replace with actual API call to create weblet
          const tempId = "new"
          router.push(`/dashboard/builder/${tempId}`)
        }}
        className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
      >
        + Create New Weblet
      </button>
    </div>
  )
}
