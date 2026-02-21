"use client"

import { useState } from "react"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Settings, CreditCard, Code2, Loader2, Rocket, CheckCircle2 } from "lucide-react"
import Link from "next/link"

type SettingsTab = "general" | "billing" | "developer"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general")
  const [displayName, setDisplayName] = useState("Jane Doe")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeveloper, setIsDeveloper] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => setIsSaving(false), 1200)
  }

  const handleUpgrade = () => {
    setIsUpgrading(true)
    setTimeout(() => {
      setIsUpgrading(false)
      setIsDeveloper(true)
    }, 1500)
  }

  const sidebarItems = [
    { id: "general" as const, label: "General", icon: Settings, disabled: false },
    { id: "billing" as const, label: "Billing", icon: CreditCard, disabled: true },
    { id: "developer" as const, label: "Developer Options", icon: Code2, disabled: false },
  ]

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">Account Settings</h1>

        <div className="flex flex-col gap-8 lg:flex-row">
          <nav className="flex flex-row gap-1 lg:w-56 lg:flex-col lg:shrink-0" aria-label="Settings navigation">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-primary/10 text-primary"
                    : item.disabled
                    ? "cursor-not-allowed text-muted-foreground/50"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.disabled && <Badge variant="secondary" className="ml-auto text-[10px]">Soon</Badge>}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1">
            {activeTab === "general" && (
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Manage your profile information.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
                      placeholder="e.g., Jane Doe"
                      maxLength={50}
                    />
                    <p className="text-xs text-muted-foreground">{displayName.length}/50 characters</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value="user@example.com"
                      disabled
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed. This is your login identity.</p>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "developer" && (
              <>
                {isDeveloper ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Developer Settings
                        <Badge className="bg-success text-success-foreground">Active</Badge>
                      </CardTitle>
                      <CardDescription>You are a registered Developer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 rounded-lg border border-border bg-accent/50 p-6">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                          <CheckCircle2 className="h-6 w-6 text-success" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">Developer Mode Enabled</p>
                          <p className="text-sm text-muted-foreground">You have full access to the Weblet Builder and Marketplace publishing tools.</p>
                        </div>
                        <Link href="/dashboard">
                          <Button>Go to Developer Dashboard</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Developer Settings</CardTitle>
                      <CardDescription>Upgrade your account to start building AI agents.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                          <Rocket className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-foreground">Unlock Developer Mode</h3>
                        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
                          Create your own Weblets, access the API, and monetize your AI creations.
                        </p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="lg">Become a Developer</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Upgrade to Developer?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to upgrade your account? This will give you access to the Weblet Builder and Marketplace publishing tools.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleUpgrade} disabled={isUpgrading}>
                                {isUpgrading ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Upgrading...
                                  </>
                                ) : (
                                  "Confirm Upgrade"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
