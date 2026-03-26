"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WebletCard } from "@/components/rsil/weblet-card"
import { AddWebletModal } from "@/components/rsil/add-weblet-modal"

type WebletOverview = {
  id: string
  name: string
  slug: string
  iconUrl: string | null
  rsilEnabled: boolean
  totalVersions?: number
  interactionCount: number
}

type OverviewResponse = {
  weblets: WebletOverview[]
}

type PerWebletScore = {
  webletId: string
  webletName: string
  compositeScore: number
  dimensions: Array<{ dimension: string; avgValue: number }>
  interactionCount: number
  decision: "NONE" | "SUGGESTION" | "AUTO_UPDATE"
  lastOptimizedAt: string | null
}

type AggregateResponse = {
  weblets: Array<{ id: string; name: string; slug: string; rsilEnabled: boolean }>
  aggregateStats: {
    totalWeblets: number
    totalInteractions: number
    avgCompositeScore: number
  }
  activeABTestCount: number
  optimizations30dCount: number
  trendData: Array<{ date: string; score: number }>
  optimizationActivity: Array<{ week: string; count: number }>
  perWebletScores: PerWebletScore[]
}

export default function RSILLandingPage() {
  const router = useRouter()

  const [overviewData, setOverviewData] = useState<WebletOverview[]>([])
  const [aggregateData, setAggregateData] = useState<AggregateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const overviewRes = await fetch("/api/rsil/overview")
      if (!overviewRes.ok) {
        throw new Error("Failed to load RSIL data")
      }
      const overview: OverviewResponse = await overviewRes.json()
      setOverviewData(overview.weblets)
    } catch (error) {
      console.error("RSIL landing page error:", error)
      toast.error("Failed to load RSIL data")
    } finally {
      setLoading(false)
    }

    try {
      const aggregateRes = await fetch("/api/rsil/aggregate")
      if (aggregateRes.ok) {
        const aggregate: AggregateResponse = await aggregateRes.json()
        setAggregateData(aggregate)
      }
    } catch {
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function handleCardClick(webletId: string) {
    router.push(`/dashboard/rsil/${webletId}`)
  }

  function handleModalSuccess() {
    router.refresh()
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-80 mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const mergedWeblets = overviewData.map((weblet) => {
    const scoreData = aggregateData?.perWebletScores.find(
      (score) => score.webletId === weblet.id
    )

    const hasScoreData = scoreData !== undefined

    return {
      id: weblet.id,
      name: weblet.name,
      iconUrl: weblet.iconUrl,
      interactionCount: weblet.interactionCount,
      totalVersions: weblet.totalVersions ?? 0,
      compositeScore: hasScoreData ? scoreData.compositeScore : null,
      decision: hasScoreData ? scoreData.decision : null,
      lastOptimizedAt: hasScoreData ? scoreData.lastOptimizedAt : null,
      status: hasScoreData ? ("active" as const) : ("pending" as const),
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">RSIL Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your RSIL-enabled weblets
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="size-4 mr-2" />
            Add Weblet
          </Button>
        </div>
      </motion.div>

      {mergedWeblets.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-xl border border-dashed">
          <p className="text-muted-foreground text-center">
            No RSIL-enabled weblets yet.
            <br />
            Click "Add Weblet" above to get started.
          </p>
          <Button onClick={() => setModalOpen(true)} variant="outline">
            <Plus className="size-4 mr-2" />
            Add Your First Weblet
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mergedWeblets.map((weblet) => (
            <WebletCard
              key={weblet.id}
              weblet={weblet}
              onClick={() => handleCardClick(weblet.id)}
            />
          ))}
        </div>
      )}

      <AddWebletModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onAdd={handleModalSuccess}
      />
    </div>
  )
}
