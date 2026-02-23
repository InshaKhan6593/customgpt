"use client"

import { useState } from "react"
import { BuilderTabs } from "./builder-tabs"
import { PublishBar } from "./publish-bar"
import { PreviewChat } from "./preview-chat"
import type { WebletCapabilities } from "@/lib/types/api"

export type BuilderState = {
  name: string
  slug: string
  description: string
  category: string
  instructions: string
  model: string
  conversationStarters: string[]
  privacyPolicy: string
  accessType: "FREE" | "SUBSCRIBERS_ONLY"
  capabilities: WebletCapabilities
  isActive: boolean
}

const defaultState: BuilderState = {
  name: "",
  slug: "",
  description: "",
  category: "",
  instructions: "",
  model: "anthropic/claude-3.5-sonnet",
  conversationStarters: [],
  privacyPolicy: "",
  accessType: "FREE",
  capabilities: {
    webSearch: false,
    codeInterpreter: false,
    imageGen: false,
    fileSearch: false,
  },
  isActive: false,
}

export function BuilderLayout({ webletId }: { webletId: string }) {
  const [state, setState] = useState<BuilderState>(defaultState)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  const updateState = (partial: Partial<BuilderState>) => {
    setState((prev) => ({ ...prev, ...partial }))
    // TODO: debounce auto-save PATCH to /api/weblets/[id]
    setSaveStatus("saved")
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Split screen container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane - Configuration */}
        <div className="w-1/2 border-r overflow-y-auto p-4">
          <BuilderTabs state={state} onUpdate={updateState} webletId={webletId} />
        </div>

        {/* Right Pane - Live Preview */}
        <div className="w-1/2 overflow-y-auto">
          <PreviewChat state={state} />
        </div>
      </div>

      {/* Sticky Bottom Publish Bar */}
      <PublishBar
        state={state}
        saveStatus={saveStatus}
        onSaveDraft={() => {
          setSaveStatus("saving")
          // TODO: PATCH /api/weblets/[id]
          setTimeout(() => setSaveStatus("saved"), 500)
        }}
        onPublish={() => {
          // TODO: PATCH /api/weblets/[id] { isActive: true, isPublic: true }
          updateState({ isActive: true })
        }}
        onUnpublish={() => {
          updateState({ isActive: false })
        }}
      />
    </div>
  )
}
