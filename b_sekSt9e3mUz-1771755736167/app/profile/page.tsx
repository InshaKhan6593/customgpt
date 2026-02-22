"use client"

import { useState } from "react"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import type { UserRole } from "@/lib/types"
import { useSession } from "next-auth/react"

function getRoleBadgeVariant(role: UserRole): "secondary" | "default" | "destructive" {
  switch (role) {
    case "USER":
      return "secondary"
    case "DEVELOPER":
      return "default"
    case "ADMIN":
      return "destructive"
    default:
      return "secondary"
  }
}

function getRoleLabel(role?: string): string {
  switch (role) {
    case "USER":
      return "User"
    case "DEVELOPER":
      return "Developer"
    case "ADMIN":
      return "Admin"
    default:
      return "User"
  }
}

export default function ProfilePage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    )
  }

  const user = session?.user

  if (!user) {
    return null // Will be redirected by proxy.ts if it was protected
  }

  const role = user.role

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : (user.email?.[0] || "?").toUpperCase()

  return (
    <div className="min-h-svh bg-background">
      <NavHeader />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">My Profile</h1>

        {/* Info Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="size-16">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {user.name || "No name set"}
                  </h2>
                  <Badge variant={getRoleBadgeVariant(role as any)}>{getRoleLabel(role)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">Member since January 2025</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA Card for USER */}
        {role === "USER" && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-foreground">Ready to build?</CardTitle>
              <CardDescription>
                Upgrade to Developer to create your own Weblets, access the builder, and publish to the marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/become-developer">Become a Developer</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* CTA Card for DEVELOPER */}
        {(role === "DEVELOPER" || role === "ADMIN") && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-foreground">Developer Account Active</CardTitle>
              <CardDescription>
                You have full access to the builder, dashboard, and marketplace publishing tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
