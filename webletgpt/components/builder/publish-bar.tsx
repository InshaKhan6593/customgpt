"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Check, AlertCircle } from "lucide-react"
import type { BuilderState } from "./builder-layout"

type PublishBarProps = {
  state: BuilderState
  saveStatus: "idle" | "saving" | "saved" | "error"
  onSaveDraft: () => void
  onPublish: () => void
  onUnpublish: () => void
}

export function PublishBar({
  state,
  saveStatus,
  onSaveDraft,
  onPublish,
  onUnpublish,
}: PublishBarProps) {
  const canPublish = state.name.trim() !== "" && state.category !== "" && state.instructions.trim() !== ""

  return (
    <div className="flex items-center justify-between border-t bg-card px-4 py-3 shrink-0">
      {/* Left: Status Indicator */}
      <div className="flex items-center gap-2 text-sm">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Saving...</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="size-4 text-green-500" />
            <span className="text-muted-foreground">Saved</span>
          </>
        )}
        {saveStatus === "error" && (
          <>
            <AlertCircle className="size-4 text-destructive" />
            <span className="text-destructive">Error saving</span>
          </>
        )}
        {saveStatus === "idle" && (
          <span className="text-muted-foreground">
            {state.isActive ? "Published" : "Draft"}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSaveDraft}>
          Save Draft
        </Button>
        {state.isActive ? (
          <Button variant="destructive" size="sm" onClick={onUnpublish}>
            Unpublish
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onPublish}
            disabled={!canPublish}
            title={!canPublish ? "Name, Category, and Instructions are required to publish" : ""}
          >
            Publish
          </Button>
        )}
      </div>
    </div>
  )
}
