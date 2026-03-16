"use client"

import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RollbackButton } from "./rollback-button"
import type { WebletVersion } from "./types"

interface VersionHistoryProps {
  versions: WebletVersion[]
  currentVersionId: string
  onRollback: (versionId: string) => void
  isActionLoading: boolean
}

export function VersionHistory({ versions, currentVersionId, onRollback, isActionLoading }: VersionHistoryProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Version</TableHead>
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
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                No version history available.
              </TableCell>
            </TableRow>
          ) : (
            versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">V{v.versionNum}</TableCell>
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
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
