"use client"

import { useState, useEffect, type ReactNode } from "react"

/**
 * Defers rendering children until after hydration.
 * Prevents hydration mismatches caused by browser extensions
 * injecting attributes (e.g. fdprocessedid) onto form elements.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
