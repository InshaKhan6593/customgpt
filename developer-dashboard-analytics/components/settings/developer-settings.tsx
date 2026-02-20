"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
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
import { Code, CheckCircle2, Rocket } from "lucide-react"

interface DeveloperSettingsProps {
  initialRole?: "USER" | "DEVELOPER"
}

export function DeveloperSettings({ initialRole = "USER" }: DeveloperSettingsProps) {
  const [role, setRole] = useState<"USER" | "DEVELOPER">(initialRole)

  const handleUpgrade = () => {
    setRole("DEVELOPER")
  }

  if (role === "DEVELOPER") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            Developer Settings
            <Badge variant="secondary" className="bg-primary/10 text-primary">Active</Badge>
          </CardTitle>
          <CardDescription>You are a registered Developer.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Developer Mode Active</p>
              <p className="text-sm text-muted-foreground">
                You have access to the Weblet Builder and Marketplace publishing tools.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/dashboard">
              <Rocket className="mr-2 h-4 w-4" />
              Go to Developer Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Developer Settings</CardTitle>
        <CardDescription>Unlock developer features for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/50 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Code className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Unlock Developer Mode</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your own Weblets, access the API, and monetize your AI creations.
            </p>
          </div>
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
                <AlertDialogAction onClick={handleUpgrade}>Confirm Upgrade</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}
