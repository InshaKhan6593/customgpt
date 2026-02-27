"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  LayoutDashboard,
  Hammer,
  Bot,
  BarChart3,
  Sparkles,
  Key,
  Wallet,
  Settings,
  CreditCard,
} from "lucide-react"
const developerToolsItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Builder", href: "/dashboard/builder", icon: Hammer },
  { label: "My Weblets", href: "/dashboard/weblets", icon: Bot },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "RSIL", href: "/dashboard/rsil", icon: Sparkles },
  { label: "API Keys", href: "/dashboard/api-keys", icon: Key },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
]

const accountItems = [
  { label: "Payouts", href: "/dashboard/payouts", icon: Wallet, disabled: true, tooltip: "Coming soon" },
  { label: "Settings", href: "/settings", icon: Settings, disabled: false },
]

function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <Link href="/" className="text-lg font-bold text-foreground">
          WebletGPT
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Developer Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {developerToolsItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accountItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {item.disabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton disabled className="opacity-50 cursor-not-allowed">
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.tooltip}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <SidebarMenuButton asChild isActive={pathname === item.href}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  // Builder [id] pages are full-screen split-pane tools — they manage their own
  // layout and should not be wrapped in the standard p-6 content padding.
  const isBuilderPage = /^\/dashboard\/builder\/.+/.test(pathname)

  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm font-medium text-foreground">Developer Dashboard</span>
        </header>
        <div className={`flex-1 overflow-hidden${isBuilderPage ? "" : " p-6"}`}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
