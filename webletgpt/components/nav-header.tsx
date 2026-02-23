"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { useSession, signOut } from "next-auth/react"
import type { User, UserRole } from "@/lib/types"

interface NavHeaderProps {}

function getInitials(user?: any): string {
  if (!user) return "?"
  if (user.name) {
    return user.name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }
  return (user.email?.[0] || "?").toUpperCase()
}

function getNavLinks(role?: UserRole) {
  if (!role) {
    return [
      { label: "Marketplace", href: "/marketplace" },
      { label: "Pricing", href: "/pricing" },
      { label: "For Developers", href: "/become-developer" },
    ]
  }
  const links: { label: string; href: string }[] = []

  if (role === "ADMIN") {
    links.push({ label: "Dashboard", href: "/dashboard" })
    links.push({ label: "Admin Panel", href: "/admin" })
  } else if (role === "DEVELOPER") {
    links.push({ label: "Dashboard", href: "/dashboard" })
  }

  links.push({ label: "Marketplace", href: "/marketplace" })
  links.push({ label: "My Chats", href: "/chats" })
  links.push({ label: "My Flows", href: "/flows" })

  return links
}

function getDropdownItems(role: UserRole) {
  const items: { label: string; href: string }[] = [
    { label: "Profile", href: "/profile" },
    { label: "Settings", href: "/settings" },
  ]

  if (role === "USER") {
    items.push({ label: "Become a Developer", href: "/become-developer" })
  }

  return items
}

export function NavHeader({}: NavHeaderProps = {}) {
  const { data: session } = useSession()
  const user = session?.user

  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isLoggedIn = !!user
  const navLinks = getNavLinks(user?.role)
  const dropdownItems = isLoggedIn ? getDropdownItems(user!.role) : []

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4">
        {/* Logo */}
        <Link href="/" className="mr-6 flex items-center font-bold text-foreground text-lg">
          WebletGPT
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                pathname === link.href
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative size-8 rounded-full">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="flex flex-col gap-1 px-2 py-1.5">
                  <p className="text-sm font-medium text-foreground leading-none">{user?.name || "No name set"}</p>
                  <p className="text-xs text-muted-foreground leading-none">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                {dropdownItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign In</Link>
            </Button>
          )}

          {/* Mobile Hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="flex flex-col gap-1 pt-6">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-3 py-2 text-sm rounded-md transition-colors ${
                      pathname === link.href
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
