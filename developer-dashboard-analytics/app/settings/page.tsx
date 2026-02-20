"use client"

import { useState } from "react"
import { NavHeader } from "@/components/nav-header"
import { SettingsSidebar } from "@/components/settings/settings-sidebar"
import { GeneralSettings } from "@/components/settings/general-settings"
import { DeveloperSettings } from "@/components/settings/developer-settings"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general")

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:flex-row">
        <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1">
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "developer" && <DeveloperSettings />}
        </div>
      </div>
    </div>
  )
}
