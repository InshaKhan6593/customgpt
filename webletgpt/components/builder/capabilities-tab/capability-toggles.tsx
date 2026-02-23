"use client"

import { Switch } from "@/components/ui/switch"
import { Globe, Code, ImageIcon, Search } from "lucide-react"
import type { BuilderState } from "../builder-layout"
import type { WebletCapabilities } from "@/lib/types/api"

type CapabilitiesTabProps = {
  state: BuilderState
  onUpdate: (partial: Partial<BuilderState>) => void
}

const CAPABILITIES = [
  {
    key: "webSearch" as keyof WebletCapabilities,
    label: "Web Search",
    description: "Search the internet for current information",
    icon: Globe,
  },
  {
    key: "codeInterpreter" as keyof WebletCapabilities,
    label: "Code Interpreter",
    description: "Allow this agent to write and execute Python code in a secure sandbox",
    icon: Code,
  },
  {
    key: "imageGen" as keyof WebletCapabilities,
    label: "Image Generation",
    description: "Generate images from text descriptions",
    icon: ImageIcon,
  },
  {
    key: "fileSearch" as keyof WebletCapabilities,
    label: "Knowledge Search",
    description: "Search uploaded knowledge files using AI",
    icon: Search,
  },
]

export function CapabilitiesTab({ state, onUpdate }: CapabilitiesTabProps) {
  const toggleCapability = (key: keyof WebletCapabilities) => {
    onUpdate({
      capabilities: {
        ...state.capabilities,
        [key]: !state.capabilities[key],
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-foreground">Agent Capabilities</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Enable tools your agent can use during conversations
        </p>
      </div>

      {CAPABILITIES.map((cap) => (
        <div
          key={cap.key}
          className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-muted">
              <cap.icon className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{cap.label}</p>
              <p className="text-xs text-muted-foreground">{cap.description}</p>
            </div>
          </div>
          <Switch
            checked={!!state.capabilities[cap.key]}
            onCheckedChange={() => toggleCapability(cap.key)}
          />
        </div>
      ))}
    </div>
  )
}
