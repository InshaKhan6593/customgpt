"use client"

import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WebletOverviewTab } from "@/components/dashboard/weblet-overview-tab"
import { WebletRsilTab } from "@/components/dashboard/weblet-rsil-tab"
import { WebletMonetizationTab } from "@/components/dashboard/weblet-monetization-tab"
import { Pencil } from "lucide-react"

export default function WebletDetailPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Codebot 3000</h1>
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Active</Badge>
          </div>
          <Button variant="outline" asChild>
            <Link href="/builder/1">
              <Pencil className="mr-2 h-4 w-4" />
              Edit in Builder
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rsil">RSIL Settings</TabsTrigger>
            <TabsTrigger value="monetization">Monetization</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <WebletOverviewTab />
          </TabsContent>
          <TabsContent value="rsil" className="mt-4">
            <WebletRsilTab />
          </TabsContent>
          <TabsContent value="monetization" className="mt-4">
            <WebletMonetizationTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
