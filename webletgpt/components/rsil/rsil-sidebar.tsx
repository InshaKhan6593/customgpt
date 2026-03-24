'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface RSILSidebarProps {
  webletId: string
  webletName: string
}

export function RSILSidebar({ webletId, webletName }: RSILSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    {
      name: 'Overview',
      href: `/dashboard/rsil/${webletId}`,
    },
    {
      name: 'Deployments',
      href: `/dashboard/rsil/${webletId}/deployments`,
    },
    {
      name: 'Advanced',
      href: `/dashboard/rsil/${webletId}/advanced`,
    },
  ]

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r bg-background">
      <div className="border-b p-4">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 w-full justify-start"
          asChild
        >
          <Link href="/dashboard/rsil">
            <ArrowLeftIcon className="size-4" />
            <span>Back to RSIL</span>
          </Link>
        </Button>
        <h2 className="truncate text-sm font-medium">{webletName}</h2>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
