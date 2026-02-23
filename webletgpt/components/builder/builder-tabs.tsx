"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Zap, Database, Code } from "lucide-react"
import { ConfigureTab } from "./configure-tab/configure-tab"
import { CapabilitiesTab } from "./capabilities-tab/capability-toggles"
import { KnowledgeTab } from "./knowledge-tab/knowledge-tab"
import { ActionsTab } from "./actions-tab/action-schema-editor"
import type { BuilderState } from "./builder-layout"

type BuilderTabsProps = {
  state: BuilderState
  onUpdate: (partial: Partial<BuilderState>) => void
  webletId: string
}

export function BuilderTabs({ state, onUpdate, webletId }: BuilderTabsProps) {
  return (
    <Tabs defaultValue="configure" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="configure" className="flex items-center gap-1.5 text-xs">
          <Settings className="size-3.5" />
          Configure
        </TabsTrigger>
        <TabsTrigger value="capabilities" className="flex items-center gap-1.5 text-xs">
          <Zap className="size-3.5" />
          Capabilities
        </TabsTrigger>
        <TabsTrigger value="knowledge" className="flex items-center gap-1.5 text-xs">
          <Database className="size-3.5" />
          Knowledge
        </TabsTrigger>
        <TabsTrigger value="actions" className="flex items-center gap-1.5 text-xs">
          <Code className="size-3.5" />
          Actions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="configure" className="mt-4">
        <ConfigureTab state={state} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="capabilities" className="mt-4">
        <CapabilitiesTab state={state} onUpdate={onUpdate} />
      </TabsContent>

      <TabsContent value="knowledge" className="mt-4">
        <KnowledgeTab webletId={webletId} />
      </TabsContent>

      <TabsContent value="actions" className="mt-4">
        <ActionsTab />
      </TabsContent>
    </Tabs>
  )
}
