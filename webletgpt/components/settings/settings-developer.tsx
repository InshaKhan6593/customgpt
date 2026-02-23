"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Code, CheckCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import type { UserRole } from "@/lib/types"

interface SettingsDeveloperProps {
  role: UserRole
  onUpgrade: () => void
}

export function SettingsDeveloper({ role, onUpgrade }: SettingsDeveloperProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/upgrade-role", { method: "POST" })
      if (!res.ok) {
        throw new Error("Failed to upgrade role")
      }
      onUpgrade()
    } catch (error) {
      console.error(error)
      // Normally we'd show a toast here
    } finally {
      setIsLoading(false)
    }
  }

  if (role === "DEVELOPER" || role === "ADMIN") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Developer Settings</CardTitle>
          <CardDescription>Manage your developer account.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4 rounded-lg border bg-accent/30 p-4">
            <CheckCircle className="size-5 text-primary mt-0.5 shrink-0" />
            <div className="flex flex-col gap-2">
              <p className="font-medium text-foreground">You are a registered Developer.</p>
              <p className="text-sm text-muted-foreground">
                You have access to the Weblet Builder, marketplace publishing tools, and the developer dashboard.
              </p>
              <Button asChild className="w-fit mt-2">
                <Link href="/dashboard">Go to Developer Dashboard</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Developer Settings</CardTitle>
        <CardDescription>Upgrade to unlock developer features.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Code className="size-5 text-primary mt-0.5 shrink-0" />
          <div className="flex flex-col gap-2">
            <p className="font-medium text-foreground">Unlock Developer Mode</p>
            <p className="text-sm text-muted-foreground">
              Create your own Weblets, access the API, and monetize your AI creations.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-fit mt-2" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Upgrading...
                    </>
                  ) : (
                    "Become a Developer"
                  )}
                </Button>
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
                  <AlertDialogAction onClick={handleUpgrade}>Confirm Upgrade</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
