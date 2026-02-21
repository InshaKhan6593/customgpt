"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Zap, Menu, X } from "lucide-react"

export function NavHeader({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">WebletGPT</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {isLoggedIn ? (
            <>
              <Link href="/marketplace">
                <Button variant="ghost" size="sm">Marketplace</Button>
              </Link>
              <Link href="/chat/new">
                <Button variant="ghost" size="sm">My Chats</Button>
              </Link>
              <Link href="/flows">
                <Button variant="ghost" size="sm">Flows</Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/marketplace">
                <Button variant="ghost" size="sm">Marketplace</Button>
              </Link>
              <Link href="/pricing">
                <Button variant="ghost" size="sm">Pricing</Button>
              </Link>
              <Link href="/builder/new">
                <Button variant="ghost" size="sm">For Developers</Button>
              </Link>
            </>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">JD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/login">
                <Button size="sm">Get Started</Button>
              </Link>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-card px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            <Link href="/marketplace" onClick={() => setMobileOpen(false)}>
              <Button variant="ghost" className="w-full justify-start">Marketplace</Button>
            </Link>
            {isLoggedIn ? (
              <>
                <Link href="/chat/new" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">My Chats</Button>
                </Link>
                <Link href="/flows" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">Flows</Button>
                </Link>
                <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
                </Link>
                <Link href="/settings" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">Settings</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/pricing" onClick={() => setMobileOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">Pricing</Button>
                </Link>
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full mt-2">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
