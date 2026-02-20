"use client"

import { cn } from "@/lib/utils"
import { Settings, CreditCard, Code } from "lucide-react"

interface SettingsSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: "general", label: "General", icon: Settings, disabled: false },
  { id: "billing", label: "Billing", icon: CreditCard, disabled: true },
  { id: "developer", label: "Developer Options", icon: Code, disabled: false },
]

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <nav className="flex flex-row gap-1 md:w-52 md:flex-col" aria-label="Settings navigation">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary/10 text-primary"
                : tab.disabled
                ? "cursor-not-allowed text-muted-foreground/50"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
