"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { BuilderTabs } from "./builder-tabs"
import { PublishBar } from "./publish-bar"
import { PreviewChat } from "./preview-chat"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"
import type { WebletCapabilities } from "@/lib/types/api"

export type BuilderState = {
  name: string
  slug: string
  description: string
  iconUrl: string
  category: string
  instructions: string
  model: string
  conversationStarters: string[]
  privacyPolicy: string
  accessType: "FREE" | "SUBSCRIBERS_ONLY"
  monthlyPrice?: number // New field for Stripe integration
  openapiSchema: string // OpenAPI specification (JSON string)
  capabilities: WebletCapabilities
  isActive: boolean
}

const defaultState: BuilderState = {
  name: "",
  slug: "",
  description: "",
  iconUrl: "",
  category: "",
  instructions: "",
  model: "anthropic/claude-3.5-sonnet",
  conversationStarters: [],
  privacyPolicy: "",
  accessType: "FREE",
  monthlyPrice: undefined,
  capabilities: {
    webSearch: false,
    codeInterpreter: false,
    imageGen: false,
    fileSearch: false,
  },
  openapiSchema: "",
  isActive: false,
}

type BuilderLayoutProps = {
  webletId: string
  initialState?: Partial<BuilderState>
}

export function BuilderLayout({ webletId, initialState }: BuilderLayoutProps) {
  const [state, setState] = useState<BuilderState>({
    ...defaultState,
    ...initialState,
  })
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const isNewWeblet = webletId === "new"

  // Auto-save: debounced PATCH to /api/weblets/[id]
  const autoSave = useCallback(
    async (updatedState: BuilderState) => {
      if (isNewWeblet) return // Don't auto-save if weblet hasn't been created yet
      setSaveStatus("saving")
      try {
        const res = await fetch(`/api/weblets/${webletId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: updatedState.name || undefined,
            description: updatedState.description || undefined,
            iconUrl: updatedState.iconUrl || undefined,
            category: updatedState.category || undefined,
            accessType: updatedState.accessType,
            monthlyPrice: updatedState.monthlyPrice, // Added
            capabilities: updatedState.capabilities,
            isActive: updatedState.isActive,
            instructions: updatedState.instructions || undefined,
            model: updatedState.model || undefined,
            openapiSchema: updatedState.openapiSchema || undefined,
            conversationStarters: updatedState.conversationStarters,
            privacyPolicy: updatedState.privacyPolicy || undefined,
          }),
        })
        if (!res.ok) throw new Error("Save failed")
        setSaveStatus("saved")
      } catch {
        setSaveStatus("error")
      }
    },
    [webletId, isNewWeblet]
  )

  const debouncedSave = useDebounce(autoSave, 300)

  const updateState = (partial: Partial<BuilderState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial }
      debouncedSave(next)
      return next
    })
  }

  const handleSaveDraft = async () => {
    setSaveStatus("saving")
    try {
      const res = await fetch(`/api/weblets/${webletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name || undefined,
          description: state.description || undefined,
          iconUrl: state.iconUrl || undefined,
          category: state.category || undefined,
          accessType: state.accessType,
          monthlyPrice: state.monthlyPrice, // Added
          capabilities: state.capabilities,
          isActive: false,
          instructions: state.instructions || undefined,
          model: state.model || undefined,
          openapiSchema: state.openapiSchema || undefined,
          conversationStarters: state.conversationStarters,
          privacyPolicy: state.privacyPolicy || undefined,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      setSaveStatus("saved")
      toast.success("Draft saved")
    } catch {
      setSaveStatus("error")
      toast.error("Failed to save draft")
    }
  }

  const handlePublish = async () => {
    // Validate required fields
    if (!state.name.trim()) {
      toast.error("Name is required to publish")
      return
    }
    if (!state.category) {
      toast.error("Category is required to publish")
      return
    }
    if (!state.instructions.trim()) {
      toast.error("Instructions are required to publish")
      return
    }

    setSaveStatus("saving")
    try {
      const res = await fetch(`/api/weblets/${webletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name,
          description: state.description,
          iconUrl: state.iconUrl || undefined,
          category: state.category,
          accessType: state.accessType,
          monthlyPrice: state.monthlyPrice, // Added
          capabilities: state.capabilities,
          isActive: true,
          isPublic: true,
          instructions: state.instructions,
          model: state.model,
          openapiSchema: state.openapiSchema || undefined,
          conversationStarters: state.conversationStarters,
          privacyPolicy: state.privacyPolicy || undefined,
        }),
      })
      if (!res.ok) throw new Error("Publish failed")
      setSaveStatus("saved")
      updateState({ isActive: true })
      toast.success("Weblet published!")
    } catch {
      setSaveStatus("error")
      toast.error("Failed to publish")
    }
  }

  const handleUnpublish = async () => {
    setSaveStatus("saving")
    try {
      const res = await fetch(`/api/weblets/${webletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false, isPublic: false }),
      })
      if (!res.ok) throw new Error("Unpublish failed")
      setSaveStatus("saved")
      updateState({ isActive: false })
      toast.success("Weblet unpublished")
    } catch {
      setSaveStatus("error")
      toast.error("Failed to unpublish")
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden">
      {/* Split screen container — CSS Grid keeps both columns at a fixed 50%
          regardless of content size. Flex would let Monaco's initial render
          influence the sizing algorithm and push the right pane wider. */}
      <div className="grid grid-cols-2 flex-1 w-full overflow-hidden">
        {/* Left Pane - Configuration */}
        <div className="min-w-0 border-r overflow-y-auto overflow-x-hidden p-4">
          <BuilderTabs state={state} onUpdate={updateState} webletId={webletId} />
        </div>

        {/* Right Pane - Live Preview */}
        <div className="min-w-0 overflow-y-auto overflow-x-hidden">
          <PreviewChat state={state} webletId={webletId} />
        </div>
      </div>

      {/* Sticky Bottom Publish Bar */}
      <PublishBar
        state={state}
        saveStatus={saveStatus}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
      />
    </div>
  )
}
