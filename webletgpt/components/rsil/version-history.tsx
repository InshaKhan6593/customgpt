"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  RotateCcw,
  FlaskConical,
  Rocket,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface VersionHistoryProps {
  versions: Array<{
    id: string
    versionNum: number
    status: string // 'DRAFT' | 'TESTING' | 'ACTIVE' | 'ROLLED_BACK' | 'ARCHIVED'
    avgScore: number | null
    model: string | null
    prompt: string
    commitMsg: string | null
    createdAt: string | Date
    isAbTest: boolean
  }>
  webletId: string
  onRollback: (webletId: string) => void
  onStartTest?: (versionId: string) => void
  onDeploy?: (versionId: string) => void
}

function formatRelativeTime(date: string | Date) {
  const now = new Date()
  const then = new Date(date)
  const diffInMs = now.getTime() - then.getTime()
  const diffInMins = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMins / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMins < 60) {
    return `${Math.max(1, diffInMins)} min ago`
  }
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
  }
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
  }
  return then.toLocaleDateString()
}

export function VersionHistory({
  versions,
  webletId,
  onRollback,
  onStartTest,
  onDeploy,
}: VersionHistoryProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Version History
            <Badge variant="secondary" className="ml-2 font-normal">
              {versions.length} version{versions.length !== 1 && "s"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No versions yet
            </div>
          ) : (
            <div className="rounded-md border bg-card/50 overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="h-9">Version</TableHead>
                    <TableHead className="h-9">Status</TableHead>
                    <TableHead className="h-9">Score</TableHead>
                    <TableHead className="h-9">Model</TableHead>
                    <TableHead className="h-9">Date</TableHead>
                    <TableHead className="h-9 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((version) => {
                    const isExpanded = expandedRows.has(version.id)
                    const isActive = version.status === "ACTIVE"
                    
                    let statusBadgeClass = "bg-muted text-muted-foreground border"
                    if (isActive) statusBadgeClass = "bg-green-500/10 text-green-600 border-green-500/20 border"
                    if (version.status === "TESTING") statusBadgeClass = "bg-amber-500/10 text-amber-600 border-amber-500/20 border"
                    if (version.status === "DRAFT") statusBadgeClass = "bg-blue-500/10 text-blue-600 border-blue-500/20 border"
                    if (version.status === "ROLLED_BACK") statusBadgeClass = "bg-red-500/10 text-red-600 border-red-500/20 border"

                    const modelDisplay = version.model 
                      ? (version.model.split("/").pop() || version.model).slice(0, 20) + (version.model.length > 20 ? "..." : "")
                      : "—"

                    return (
                      <Collapsible
                        key={version.id}
                        asChild
                        open={isExpanded}
                        onOpenChange={() => toggleRow(version.id)}
                      >
                        <>
                          <TableRow 
                            className={cn(
                              "hover:bg-muted/20 group cursor-pointer",
                              isActive && "border-l-2 border-l-green-500"
                            )}
                            onClick={() => toggleRow(version.id)}
                          >
                            <TableCell className="py-2.5 px-2">
                              <Button variant="ghost" size="icon" className="h-6 w-6 p-0" asChild>
                                <CollapsibleTrigger>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </CollapsibleTrigger>
                              </Button>
                            </TableCell>
                            <TableCell className="py-2.5 font-mono font-medium text-sm">
                              V{version.versionNum}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge variant="outline" className={statusBadgeClass}>
                                {version.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 font-medium text-sm">
                              {version.avgScore !== null ? (
                                <span
                                  className={cn(
                                    version.avgScore > 0.7 && "text-green-500",
                                    version.avgScore >= 0.5 && version.avgScore <= 0.7 && "text-yellow-500",
                                    version.avgScore < 0.5 && "text-red-500"
                                  )}
                                >
                                  {version.avgScore.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-sm text-muted-foreground font-mono">
                              {modelDisplay}
                            </TableCell>
                            <TableCell className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(version.createdAt)}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                {isActive && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onRollback(webletId)}
                                    className="h-8 text-xs"
                                  >
                                    <RotateCcw className="mr-1 h-3 w-3" /> Rollback
                                  </Button>
                                )}
                                {version.status === "DRAFT" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onStartTest?.(version.id)}
                                      className="h-8 text-xs"
                                    >
                                      <FlaskConical className="mr-1 h-3 w-3" /> Test
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => onDeploy?.(version.id)}
                                      className="h-8 text-xs"
                                    >
                                      <Rocket className="mr-1 h-3 w-3" /> Deploy
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          <CollapsibleContent asChild>
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={7} className="p-0 border-b">
                                <div className="px-4 pb-4 pt-2 bg-muted/10">
                                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                                    {version.commitMsg || "No changelog"}
                                  </p>
                                  <pre className="bg-muted/30 rounded-lg p-4 text-xs font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto border">
                                    {version.prompt}
                                  </pre>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
