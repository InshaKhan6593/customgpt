"use client"

import { useState } from "react"
import { NavHeader } from "@/components/nav-header"
import { SettingsGeneral } from "@/components/settings/settings-general"
import { SettingsDeveloper } from "@/components/settings/settings-developer"
import { SettingsDangerZone } from "@/components/settings/settings-danger-zone"
import { cn } from "@/lib/utils"
import { Settings, CreditCard, Code, AlertTriangle } from "lucide-react"
import { useSession } from "next-auth/react"
import { Loader2 } from "lucide-react"

const sidebarItems = [
  { id: "general", label: "General", icon: Settings, disabled: false },
  { id: "billing", label: "Billing", icon: CreditCard, disabled: true },
  { id: "developer", label: "Developer Options", icon: Code, disabled: false },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle, disabled: false },
]

export default function SettingsPage() {
  const { data: session, status, update } = useSession()
  const [activeTab, setActiveTab] = useState("general")

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    )
  }

  const user = session?.user

  if (!user) {
    return null // Handled by proxy.ts redirect
  }

  return (
    <div className="min-h-svh bg-background">
      <NavHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <nav className="w-full md:w-56 shrink-0">
            <ul className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
              {sidebarItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => !item.disabled && setActiveTab(item.id)}
                    disabled={item.disabled}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap",
                      activeTab === item.id
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                      item.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                    {item.disabled && (
                      <span className="ml-auto text-xs text-muted-foreground">Soon</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "general" && (
              <SettingsGeneral user={{
                ...user,
                name: user.name ?? "",
                email: user.email ?? "",
              }} />
            )}
            {activeTab === "developer" && (
              <SettingsDeveloper 
                role={user.role} 
                onUpgrade={async () => {
                  await update({ role: "DEVELOPER" })
                  window.location.href = "/dashboard"
                }} 
              />
            )}
            {activeTab === "danger" && (
              <SettingsDangerZone />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
