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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import {
  X,
  Plus,
  GripVertical,
  ImageIcon,
  Check,
  ChevronsUpDown,
  PenTool,
  Code,
  BarChart2,
  Megaphone,
  GraduationCap,
  HeadphonesIcon,
  Microscope,
  Palette,
  Zap,
  Wallet,
  Activity,
  Scale,
  Package,
  Sparkles,
} from "lucide-react"
import { useState } from "react"
import type { BuilderState } from "../builder-layout"
import {
  MAX_INSTRUCTIONS_LENGTH,
  MAX_CONVERSATION_STARTERS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { value: "WRITING", label: "Writing", icon: PenTool, desc: "Blog posts, emails, copy" },
  { value: "CODE", label: "Code", icon: Code, desc: "Code review, generation, debugging" },
  { value: "DATA_ANALYSIS", label: "Data Analysis", icon: BarChart2, desc: "Data insights, reports" },
  { value: "MARKETING", label: "Marketing", icon: Megaphone, desc: "Campaigns, social media, ads" },
  { value: "EDUCATION", label: "Education", icon: GraduationCap, desc: "Tutoring, quizzes, learning" },
  { value: "CUSTOMER_SUPPORT", label: "Customer Support", icon: HeadphonesIcon, desc: "Help desk, FAQ bots" },
  { value: "RESEARCH", label: "Research", icon: Microscope, desc: "Literature review, synthesis" },
  { value: "CREATIVE", label: "Creative", icon: Palette, desc: "Stories, art prompts, music" },
  { value: "PRODUCTIVITY", label: "Productivity", icon: Zap, desc: "Task management, planning" },
  { value: "FINANCE", label: "Finance", icon: Wallet, desc: "Budgeting, analysis, reporting" },
  { value: "HEALTH", label: "Health", icon: Activity, desc: "Wellness, fitness, medical info" },
  { value: "LEGAL", label: "Legal", icon: Scale, desc: "Contracts, compliance, research" },
  { value: "OTHER", label: "Other", icon: Package, desc: "General purpose agents" },
]

const MODELS = [
  { value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", provider: "Anthropic", cost: "$$", desc: "Best for complex reasoning" },
  { value: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", cost: "$$", desc: "Fast multimodal" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", cost: "$", desc: "Affordable and fast" },
  { value: "liquid/lfm-2-24b-a2b", label: "Liquid LFM-2 24B", provider: "Liquid", cost: "$", desc: "Fast, specialized capabilities" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", cost: "$", desc: "Fast, strong reasoning" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "Google", cost: "$", desc: "Ultra cheap and fast" },
  { value: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B", provider: "Qwen", cost: "$", desc: "Very cheap, strong reasoning" },
  { value: "qwen/qwen3.5-35b-a3b", label: "Qwen 3.5 35B", provider: "Qwen", cost: "$", desc: "Fast and intelligent" },
  { value: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "Meta", cost: "Free", desc: "Open source, strong" },
  { value: "deepseek/deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek", cost: "$", desc: "Reasoning specialist" },
  { value: "minimax/minimax-m2.5", label: "Minimax M2.5", provider: "Minimax", cost: "$", desc: "Optimized for coding & office tasks" },
  { value: "qwen/qwen3.5-flash-02-23", label: "Qwen 3.5 Flash", provider: "Qwen", cost: "$", desc: "Fast vision-language, 1M context" },
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
  const [openCategory, setOpenCategory] = useState(false)

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

  const selectedCategory = CATEGORIES.find((c) => c.value === state.category)

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
      <div className="space-y-2 flex flex-col">
        <Label>Category *</Label>
        <Popover open={openCategory} onOpenChange={setOpenCategory}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={openCategory}
              className="w-full justify-between font-normal h-10 px-3 py-2 bg-transparent"
            >
              {selectedCategory ? (
                <div className="flex items-center gap-2 truncate">
                  <selectedCategory.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selectedCategory.label}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">Select a category...</span>
              )}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandList>
                <CommandEmpty>No category found.</CommandEmpty>
                <CommandGroup>
                  {CATEGORIES.map((cat) => (
                    <CommandItem
                      key={cat.value}
                      value={cat.label}
                      onSelect={() => {
                        onUpdate({ category: cat.value })
                        setOpenCategory(false)
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <cat.icon className={cn(
                          "size-4 shrink-0",
                          state.category === cat.value ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className="font-medium truncate">{cat.label}</span>
                        <span className="text-muted-foreground text-xs hidden sm:inline-block truncate">
                          — {cat.desc}
                        </span>
                      </div>
                      <Check
                        className={cn(
                          "ml-2 size-4 shrink-0",
                          state.category === cat.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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

      {/* RSIL — Self-Improving Loop */}
      <div className="flex flex-col gap-2 rounded-md border p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Self-Improving Loop (RSIL)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically optimize this weblet&apos;s prompt using user feedback scores. Runs A/B tests and promotes winners daily.
            </p>
          </div>
          <Switch
            checked={state.rsilEnabled}
            onCheckedChange={(checked) => onUpdate({ rsilEnabled: checked })}
          />
        </div>
        {state.rsilEnabled && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5 border border-amber-200 dark:border-amber-800">
            RSIL is active. User thumbs-up/down ratings on conversations will be analyzed nightly and used to auto-improve this weblet&apos;s instructions via A/B testing.
          </p>
        )}
      </div>

      {/* Access Toggle */}
      <div className="flex flex-col gap-4 rounded-md border p-4 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Subscribers Only</p>
            <p className="text-xs text-muted-foreground">
              Restrict access to paying subscribers
            </p>
          </div>
          <Switch
            checked={state.accessType === "SUBSCRIBERS_ONLY"}
            onCheckedChange={(checked) => {
              // If toggling off, we can optionally clear the price, but let's keep it in state.
              onUpdate({ accessType: checked ? "SUBSCRIBERS_ONLY" : "FREE" })
            }}
          />
        </div>

        {state.accessType === "SUBSCRIBERS_ONLY" && (
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="monthlyPrice">Monthly Price (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="monthlyPrice"
                type="number"
                placeholder="10.00"
                className="pl-7"
                min="1"
                step="0.01"
                value={state.monthlyPrice || ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  onUpdate({ monthlyPrice: isNaN(val) ? undefined : val })
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Set the monthly subscription price for users to access this weblet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
