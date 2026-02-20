"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Menu, X, LayoutDashboard, Settings, LogOut } from "lucide-react"
import { ClientOnly } from "@/components/client-only"

interface NavHeaderProps {
  isLoggedIn?: boolean
  userName?: string
  userEmail?: string
}

export function NavHeader({ isLoggedIn = false, userName = "Jane Doe", userEmail = "jane@example.com" }: NavHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">W</span>
          </div>
          <span className="text-lg font-semibold text-foreground">WebletGPT</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 md:flex">
          {isLoggedIn ? (
            <>
              <Link href="/marketplace" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Marketplace
              </Link>
              <Link href="/chat" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                My Chats
              </Link>
            </>
          ) : (
            <>
              <Link href="/marketplace" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Marketplace
              </Link>
              <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                Pricing
              </Link>
              <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                For Developers
              </Link>
            </>
          )}
        </div>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <ClientOnly
            fallback={
              isLoggedIn ? (
                <div className="h-9 w-9 rounded-full bg-muted" />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-16 rounded-md bg-muted" />
                  <div className="h-9 w-24 rounded-md bg-muted" />
                </div>
              )
            }
          >
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-2 p-2">
                    <div className="flex flex-col">
                      <p className="text-sm font-medium text-foreground">{userName}</p>
                      <p className="text-xs text-muted-foreground">{userEmail}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex cursor-pointer items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex cursor-pointer items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="flex cursor-pointer items-center gap-2 text-destructive">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link href="/login">Get Started</Link>
                </Button>
              </>
            )}
          </ClientOnly>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-2">
            {isLoggedIn ? (
              <>
                <Link href="/marketplace" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  Marketplace
                </Link>
                <Link href="/chat" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  My Chats
                </Link>
                <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  Dashboard
                </Link>
                <Link href="/settings" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  Settings
                </Link>
              </>
            ) : (
              <>
                <Link href="/marketplace" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  Marketplace
                </Link>
                <Link href="/pricing" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  Pricing
                </Link>
                <Link href="/login" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  For Developers
                </Link>
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" className="flex-1" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button className="flex-1" asChild>
                    <Link href="/login">Get Started</Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
