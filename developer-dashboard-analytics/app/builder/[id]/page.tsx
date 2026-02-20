"use client"

import { useState } from "react"
import { BuilderTopNav } from "@/components/builder/builder-top-nav"
import { ConfigPanel } from "@/components/builder/config-panel"
import { LivePreview } from "@/components/builder/live-preview"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"

export default function BuilderPage() {
  const [webletName, setWebletName] = useState("Untitled Weblet")
  const [status, setStatus] = useState<"Draft" | "Active">("Draft")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  const handlePublish = async () => {
    setIsSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setStatus("Active")
    setIsSaving(false)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <BuilderTopNav
        name={webletName}
        onNameChange={setWebletName}
        status={status}
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={isSaving}
      />
      <div className="flex-1 overflow-hidden">
        {/* Desktop split pane */}
        <div className="hidden h-full md:block">
          <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={45} minSize={30}>
              <ConfigPanel systemPrompt={systemPrompt} onSystemPromptChange={setSystemPrompt} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={55} minSize={30}>
              <LivePreview webletName={webletName} systemPrompt={systemPrompt} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        {/* Mobile stacked */}
        <div className="flex h-full flex-col md:hidden">
          <div className="flex-1 overflow-y-auto border-b border-border">
            <ConfigPanel systemPrompt={systemPrompt} onSystemPromptChange={setSystemPrompt} />
          </div>
          <div className="h-[40vh]">
            <LivePreview webletName={webletName} systemPrompt={systemPrompt} />
          </div>
        </div>
      </div>
    </div>
  )
}
