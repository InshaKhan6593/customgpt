"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type OptimizeLauncherPageProps = {
  params: Promise<{ webletId: string }>
}

export default function OptimizeLauncherPage({ params }: OptimizeLauncherPageProps) {
  const router = useRouter()
  const [webletId, setWebletId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(true)

  useEffect(() => {
    params.then((resolved) => setWebletId(resolved.webletId))
  }, [params])

  useEffect(() => {
    if (!webletId || !isRunning) return

    let cancelled = false

    async function runOptimization() {
      try {
        const res = await fetch('/api/rsil/optimize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webletId }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Optimization failed')
        }

        if (cancelled) return

        toast.success('Prompt optimization complete')
        router.replace(data.reviewPath)
      } catch (error) {
        if (cancelled) return

        toast.error(error instanceof Error ? error.message : 'Optimization failed')
        setIsRunning(false)
      }
    }

    void runOptimization()

    return () => {
      cancelled = true
    }
  }, [isRunning, router, webletId])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Optimize Prompt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generating a new draft version and preparing a detailed before-and-after review.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            {isRunning ? 'Optimization in progress' : 'Optimization failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isRunning ? (
            <>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The optimization request did not complete. You can return to deployments and try again.
              </p>
              <Button variant="outline" onClick={() => router.push(`/dashboard/rsil/${webletId}/deployments`)}>
                Back to Deployments
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
