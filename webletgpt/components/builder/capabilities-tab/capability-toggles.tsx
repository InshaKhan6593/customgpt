"use client"

import { Switch } from "@/components/ui/switch"
import { Globe, Code, ImageIcon, Search } from "lucide-react"
import type { BuilderState } from "../builder-layout"
import type { WebletCapabilities } from "@/lib/types/api"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

  const handleImageModelChange = (value: string) => {
    onUpdate({
      capabilities: {
        ...state.capabilities,
        imageGenModel: value
      }
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
        <div key={cap.key} className="flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50">
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
          
          {/* Conditional dropdown for Image Generation model */}
          {cap.key === "imageGen" && state.capabilities.imageGen && (
            <div className="ml-10 px-4 py-2 border-l-2 border-primary/20 bg-muted/30 rounded-r-md">
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Model</label>
              <Select 
                value={state.capabilities.imageGenModel || "dall-e-3"} 
                onValueChange={handleImageModelChange}
              >
                <SelectTrigger className="w-full text-xs h-8">
                  <SelectValue placeholder="Select image model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dall-e-3">DALL-E 3 (High Quality, Default)</SelectItem>
                  <SelectItem value="google/gemini-2.5-flash">Gemini 2.5 Flash (Fast, Cheap)</SelectItem>
                  <SelectItem value="black-forest-labs/flux-schnell">Flux Schnell (Fast, Cheap)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
