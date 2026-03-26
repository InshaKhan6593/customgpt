"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MoreVertical, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

type VersionStatus = "DRAFT" | "TESTING" | "ACTIVE" | "ROLLED_BACK" | "ARCHIVED"

type Version = {
  id: string
  versionNum: number
  status: VersionStatus
  createdAt: string
  avgScore: number | null
  isAbTest: boolean
  abTestWinner: boolean | null
  hasOptimizationResult?: boolean
}

type DeploymentsPageProps = {
  params: Promise<{ webletId: string }>
}

export default function DeploymentsPage({ params }: DeploymentsPageProps) {
  const router = useRouter()
  const [webletId, setWebletId] = useState<string | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  useEffect(() => {
    params.then((p) => setWebletId(p.webletId))
  }, [params])

  const fetchVersions = useCallback(async () => {
    if (!webletId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/weblets/${webletId}/versions`)
      if (!res.ok) {
        throw new Error("Failed to fetch versions")
      }
      const data = await res.json()
      const versionsArray = Array.isArray(data) ? data : (data.data || [])
      setVersions(versionsArray)
    } catch (error) {
      console.error("Fetch versions error:", error)
      toast.error("Failed to load versions")
    } finally {
      setLoading(false)
    }
  }, [webletId])

  useEffect(() => {
    if (webletId) {
      fetchVersions()
    }
  }, [webletId, fetchVersions])

  async function handleOptimize() {
    if (!webletId || optimizing) return

    setOptimizing(true)
    router.push(`/dashboard/rsil/${webletId}/optimize`)
  }

  function handleViewOptimizationResults(versionId: string) {
    if (!webletId) return

    router.push(`/dashboard/rsil/${webletId}/deployments/${versionId}/optimization`)
  }

  async function handleDeploy(versionId: string) {
    if (!webletId || actionLoading) return

    setActionLoading(versionId)
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId, versionId, action: "deploy" }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Deploy failed")
      }

      toast.success("Version deployed to production")
      router.refresh()
      await fetchVersions()
    } catch (error) {
      console.error("Deploy error:", error)
      toast.error(error instanceof Error ? error.message : "Deploy failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleStartTest(versionId: string) {
    if (!webletId || actionLoading) return

    setActionLoading(versionId)
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId, versionId, action: "test" }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "A/B test start failed")
      }

      toast.success("A/B test started")
      router.refresh()
      await fetchVersions()
    } catch (error) {
      console.error("Start test error:", error)
      toast.error(error instanceof Error ? error.message : "A/B test start failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleConcludeTest(versionId: string) {
    if (!webletId || actionLoading) return

    setActionLoading(versionId)
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId, versionId, action: "conclude" }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Test conclusion failed")
      }

      toast.success("A/B test concluded and promoted")
      router.refresh()
      await fetchVersions()
    } catch (error) {
      console.error("Conclude test error:", error)
      toast.error(error instanceof Error ? error.message : "Test conclusion failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelTest() {
    if (!webletId || actionLoading) return

    setActionLoading("cancel")
    try {
      const res = await fetch("/api/rsil/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId, action: "cancel" }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Test cancellation failed")
      }

      toast.success("A/B test cancelled")
      router.refresh()
      await fetchVersions()
    } catch (error) {
      console.error("Cancel test error:", error)
      toast.error(error instanceof Error ? error.message : "Test cancellation failed")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRollback() {
    if (!webletId || actionLoading) return

    setActionLoading("rollback")
    try {
      const res = await fetch("/api/rsil/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Rollback failed")
      }

      toast.success("Rolled back to previous version")
      router.refresh()
      await fetchVersions()
    } catch (error) {
      console.error("Rollback error:", error)
      toast.error(error instanceof Error ? error.message : "Rollback failed")
    } finally {
      setActionLoading(null)
    }
  }

  function getStatusBadge(status: VersionStatus, isAbTest: boolean, winner: boolean | null) {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="default">Active</Badge>
      case "TESTING":
        return <Badge variant="secondary">Testing</Badge>
      case "DRAFT":
        return <Badge variant="outline">Draft</Badge>
      case "ARCHIVED":
        if (isAbTest && winner === true) {
          return <Badge variant="outline">Winner</Badge>
        }
        if (isAbTest && winner === false) {
          return <Badge variant="outline">Loser</Badge>
        }
        return <Badge variant="outline">Archived</Badge>
      case "ROLLED_BACK":
        return <Badge variant="outline">Rolled Back</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function getActionsForStatus(version: Version) {
    const isProcessing = actionLoading === version.id
    const optimizationResultsAction = version.hasOptimizationResult ? (
      <DropdownMenuItem
        onClick={() => handleViewOptimizationResults(version.id)}
        disabled={isProcessing}
      >
        Optimization Results
      </DropdownMenuItem>
    ) : null

    switch (version.status) {
      case "ACTIVE":
        return (
          <>
            {optimizationResultsAction}
            <DropdownMenuItem
              onClick={() => handleRollback()}
              disabled={isProcessing || actionLoading === "rollback"}
            >
              Rollback
            </DropdownMenuItem>
          </>
        )

      case "TESTING":
        return (
          <>
            {optimizationResultsAction}
            <DropdownMenuItem
              onClick={() => handleConcludeTest(version.id)}
              disabled={isProcessing}
            >
              Promote to Production
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleConcludeTest(version.id)}
              disabled={isProcessing}
            >
              Conclude Test
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleCancelTest()}
              disabled={isProcessing || actionLoading === "cancel"}
              variant="destructive"
            >
              Cancel Test
            </DropdownMenuItem>
          </>
        )

      case "DRAFT":
      case "ARCHIVED":
        return (
          <>
            {optimizationResultsAction}
            <DropdownMenuItem
              onClick={() => handleDeploy(version.id)}
              disabled={isProcessing}
            >
              Deploy to Production
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStartTest(version.id)}
              disabled={isProcessing}
            >
              Start A/B Test
            </DropdownMenuItem>
          </>
        )

      default:
        return optimizationResultsAction
    }
  }

  const activeTest = versions.find((v) => v.status === "TESTING")

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage versions and deploy updates
          </p>
        </div>
        <Button onClick={handleOptimize} disabled={optimizing}>
          <Sparkles className="size-4 mr-2" />
          {optimizing ? "Optimizing..." : "Optimize Prompt"}
        </Button>
      </div>

      {activeTest && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-500/50 bg-blue-500/10 px-4 py-3">
          <Badge variant="secondary">A/B Test Running</Badge>
          <span className="text-sm">
            Version {activeTest.versionNum} is currently being tested
          </span>
        </div>
      )}

      {versions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 rounded-xl border border-dashed">
          <p className="text-muted-foreground text-center">
            No versions found.
            <br />
            Optimize your prompt to create a new version.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.id}>
                  <TableCell className="font-medium">
                    v{version.versionNum}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(version.status, version.isAbTest, version.abTestWinner)}
                  </TableCell>
                  <TableCell>
                    {new Date(version.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    {version.avgScore !== null
                      ? version.avgScore.toFixed(2)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!!actionLoading}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {getActionsForStatus(version)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
