"use client"

import { Fragment, useState } from "react"
import { ChevronDown, ChevronUp, Clock } from "lucide-react"
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
import { cn } from "@/lib/utils"
import { RollbackButton } from "./rollback-button"
import type { WebletVersion } from "./types"

interface VersionHistoryProps {
  versions: WebletVersion[]
  currentVersionId: string
  onRollback: (versionId: string) => void
  isActionLoading: boolean
}

export function VersionHistory({ versions, currentVersionId, onRollback, isActionLoading }: VersionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function getPromptPreview(prompt: string) {
    const normalized = prompt.replace(/\s+/g, " ").trim()
    if (normalized.length <= 80) return normalized
    return `${normalized.slice(0, 80)}...`
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Version</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Commit Message</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                No version history available.
              </TableCell>
            </TableRow>
          ) : (
            versions.map((v) => {
              const isExpanded = expandedId === v.id

              return (
                <Fragment key={v.id}>
                  <TableRow
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  >
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedId(isExpanded ? null : v.id)
                          }}
                          aria-label={isExpanded ? `Collapse V${v.versionNum} prompt` : `Expand V${v.versionNum} prompt`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className={cn("size-4 transition-transform", isExpanded && "rotate-180")} />
                          )}
                        </Button>
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium">V{v.versionNum}</div>
                          <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                            {getPromptPreview(v.prompt)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[190px] truncate">{v.model}</TableCell>
                    <TableCell>
                      {v.id === currentVersionId ? (
                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-500 border-emerald-500/20">
                          ACTIVE
                        </Badge>
                      ) : v.isAbTest && !v.abTestEndedAt ? (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500 border-blue-500/20">
                          TESTING
                        </Badge>
                      ) : v.status === "ROLLED_BACK" ? (
                        <Badge variant="destructive">ROLLED_BACK</Badge>
                      ) : (
                        <Badge variant="outline">ARCHIVED</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {v.avgScore ? (
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{v.avgScore.toFixed(1)}</span>
                          <span className="text-muted-foreground text-xs">/10</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {v.commitMsg || "No message"}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3" />
                        {new Date(v.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {v.id !== currentVersionId && (
                        <RollbackButton
                          versionId={v.id}
                          versionNum={v.versionNum}
                          onRollback={onRollback}
                          disabled={isActionLoading}
                        />
                      )}
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20 px-6 py-4">
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">System Instructions</span>
                          <pre className="bg-muted rounded-lg p-4 text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {v.prompt}
                          </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
