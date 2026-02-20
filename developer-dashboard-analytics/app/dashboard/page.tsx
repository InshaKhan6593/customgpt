"use client"

import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { DashboardStatsCards } from "@/components/dashboard/stats-cards"
import { DashboardChart } from "@/components/dashboard/dashboard-chart"
import { WebletTable } from "@/components/dashboard/weblet-table"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Developer Dashboard</h1>
            <p className="text-sm text-muted-foreground">Overview of your Weblet portfolio performance.</p>
          </div>
          <Link
            href="/dashboard/payouts"
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage Payouts
          </Link>
        </div>

        <DashboardStatsCards />
        <div className="mt-6">
          <DashboardChart />
        </div>
        <div className="mt-6">
          <WebletTable />
        </div>
      </div>
    </div>
  )
}
