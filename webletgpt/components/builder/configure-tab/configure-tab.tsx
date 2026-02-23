"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { X, Plus, GripVertical, ImageIcon } from "lucide-react"
import { useState } from "react"
import type { BuilderState } from "../builder-layout"
import {
  MAX_INSTRUCTIONS_LENGTH,
  MAX_CONVERSATION_STARTERS,
} from "@/lib/constants"

const CATEGORIES = [
  { value: "WRITING", label: "Writing", icon: "✍️", desc: "Blog posts, emails, copy" },
  { value: "CODE", label: "Code", icon: "💻", desc: "Code review, generation, debugging" },
  { value: "DATA_ANALYSIS", label: "Data Analysis", icon: "📊", desc: "Data insights, reports" },
  { value: "MARKETING", label: "Marketing", icon: "📢", desc: "Campaigns, social media, ads" },
  { value: "EDUCATION", label: "Education", icon: "🎓", desc: "Tutoring, quizzes, learning" },
  { value: "CUSTOMER_SUPPORT", label: "Customer Support", icon: "🎧", desc: "Help desk, FAQ bots" },
  { value: "RESEARCH", label: "Research", icon: "🔬", desc: "Literature review, synthesis" },
  { value: "CREATIVE", label: "Creative", icon: "🎨", desc: "Stories, art prompts, music" },
  { value: "PRODUCTIVITY", label: "Productivity", icon: "⚡", desc: "Task management, planning" },
  { value: "FINANCE", label: "Finance", icon: "💰", desc: "Budgeting, analysis, reporting" },
  { value: "HEALTH", label: "Health", icon: "🏥", desc: "Wellness, fitness, medical info" },
  { value: "LEGAL", label: "Legal", icon: "⚖️", desc: "Contracts, compliance, research" },
  { value: "OTHER", label: "Other", icon: "📦", desc: "General purpose agents" },
]

const MODELS = [
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", provider: "Anthropic", cost: "$$", desc: "Best for complex reasoning" },
  { value: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", cost: "$$", desc: "Fast multimodal" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", cost: "$", desc: "Affordable and fast" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", provider: "Google", cost: "$", desc: "Fast and cheap" },
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "Meta", cost: "Free", desc: "Open source, strong" },
  { value: "deepseek/deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek", cost: "$", desc: "Reasoning specialist" },
]

type ConfigureTabProps = {
  state: BuilderState
  onUpdate: (partial: Partial<BuilderState>) => void
}

function getInstructionsColor(length: number): string {
  if (length > 7500) return "text-red-500"
  if (length > 6000) return "text-amber-500"
  return "text-muted-foreground"
}

export function ConfigureTab({ state, onUpdate }: ConfigureTabProps) {
  const [newStarter, setNewStarter] = useState("")

  const addStarter = () => {
    if (!newStarter.trim()) return
    if (state.conversationStarters.length >= MAX_CONVERSATION_STARTERS) return
    onUpdate({
      conversationStarters: [...state.conversationStarters, newStarter.trim()],
    })
    setNewStarter("")
  }

  const removeStarter = (index: number) => {
    onUpdate({
      conversationStarters: state.conversationStarters.filter((_, i) => i !== index),
    })
  }

  const startersAtLimit = state.conversationStarters.length >= MAX_CONVERSATION_STARTERS

  return (
    <div className="flex flex-col gap-5">
      {/* Icon / Avatar */}
      <div className="space-y-2">
        <Label>Icon / Profile Picture</Label>
        <div className="flex items-center gap-4">
          <div className="relative size-16 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden shrink-0">
            {state.iconUrl ? (
              <img
                src={state.iconUrl}
                alt="Weblet icon"
                className="size-full object-cover"
              />
            ) : (
              <span className="text-2xl font-semibold text-muted-foreground">
                {state.name ? state.name[0].toUpperCase() : <ImageIcon className="size-6" />}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <Input
              placeholder="https://example.com/icon.png"
              value={state.iconUrl}
              onChange={(e) => onUpdate({ iconUrl: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Enter a URL for your weblet's icon (PNG, JPG, or WebP). Shown on marketplace cards.
            </p>
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="My AI Agent"
          value={state.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label>Category *</Label>
        <Select
          value={state.category}
          onValueChange={(val) => onUpdate({ category: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category..." />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                <span className="flex items-center gap-2">
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="text-muted-foreground text-xs">— {cat.desc}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="A short description shown on the marketplace card..."
          value={state.description}
          onChange={(e) => {
            if (e.target.value.length <= 300) {
              onUpdate({ description: e.target.value })
            }
          }}
          rows={3}
        />
        <p className="text-xs text-muted-foreground text-right">
          {state.description.length}/300
        </p>
      </div>

      {/* Instructions / System Prompt */}
      <div className="space-y-2">
        <Label htmlFor="instructions">Agent Instructions / System Prompt *</Label>
        <Textarea
          id="instructions"
          placeholder="You are a helpful assistant that..."
          value={state.instructions}
          onChange={(e) => {
            if (e.target.value.length <= MAX_INSTRUCTIONS_LENGTH) {
              onUpdate({ instructions: e.target.value })
            }
          }}
          rows={8}
          className="font-mono text-sm"
        />
        <p className={`text-xs text-right ${getInstructionsColor(state.instructions.length)}`}>
          {state.instructions.length.toLocaleString()}/{MAX_INSTRUCTIONS_LENGTH.toLocaleString()} characters
        </p>
      </div>

      {/* Model Selector */}
      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          value={state.model}
          onValueChange={(val) => onUpdate({ model: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a model..." />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-muted-foreground text-xs">({m.provider})</span>
                  <span className="text-xs font-mono text-amber-600">{m.cost}</span>
                  <span className="text-muted-foreground text-xs">— {m.desc}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Conversation Starters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Conversation Starters</Label>
          <span className="text-xs text-muted-foreground">
            {state.conversationStarters.length}/{MAX_CONVERSATION_STARTERS}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {state.conversationStarters.map((starter, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm"
            >
              <GripVertical className="size-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1">{starter}</span>
              <button
                onClick={() => removeStarter(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              placeholder={startersAtLimit ? "Maximum reached" : "Add a conversation starter..."}
              value={newStarter}
              onChange={(e) => setNewStarter(e.target.value)}
              disabled={startersAtLimit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addStarter()
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={addStarter}
              disabled={startersAtLimit || !newStarter.trim()}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {startersAtLimit && (
            <p className="text-xs text-amber-500">
              Maximum {MAX_CONVERSATION_STARTERS} conversation starters reached
            </p>
          )}
        </div>
      </div>

      {/* Privacy Policy */}
      <div className="space-y-2">
        <Label htmlFor="privacyPolicy">Privacy Policy URL</Label>
        <Input
          id="privacyPolicy"
          placeholder="https://example.com/privacy"
          value={state.privacyPolicy}
          onChange={(e) => onUpdate({ privacyPolicy: e.target.value })}
        />
      </div>

      {/* Access Toggle */}
      <div className="flex items-center justify-between rounded-md border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Subscribers Only</p>
          <p className="text-xs text-muted-foreground">
            Restrict access to paying subscribers
          </p>
        </div>
        <Switch
          checked={state.accessType === "SUBSCRIBERS_ONLY"}
          onCheckedChange={(checked) =>
            onUpdate({ accessType: checked ? "SUBSCRIBERS_ONLY" : "FREE" })
          }
        />
      </div>
    </div>
  )
}
