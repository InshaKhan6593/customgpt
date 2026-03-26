import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Activity, CalendarClock, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WebletCardProps {
  weblet: {
    id: string
    name: string
    iconUrl?: string | null
    interactionCount?: number
    totalVersions?: number
    compositeScore?: number | null
    decision?: 'NONE' | 'SUGGESTION' | 'AUTO_UPDATE' | null
    lastOptimizedAt?: string | null
    status: 'active' | 'pending'
  }
  onClick?: () => void
}

export function WebletCard({ weblet, onClick }: WebletCardProps) {
  const { name, iconUrl, interactionCount = 0, totalVersions = 0, lastOptimizedAt, status } = weblet
  const isActive = status === 'active'

  const optimizedDate = lastOptimizedAt ? new Date(lastOptimizedAt) : null
  const lastOptimizedLabel = optimizedDate
    ? optimizedDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : "Not optimized yet"

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'WB'

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        onClick && 'active:scale-[0.98]',
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="size-10 rounded-lg">
              <AvatarImage src={iconUrl || undefined} alt={name} className="rounded-lg object-cover" />
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">RSIL-enabled weblet</p>
            </div>
          </div>
          <Badge
            variant={isActive ? 'default' : 'outline'}
            className={
              isActive
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'text-muted-foreground'
            }
          >
            {isActive ? 'Active' : 'Pending'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
          <p className="text-muted-foreground flex items-center gap-1 uppercase tracking-wide text-[10px]">
            <CalendarClock className="size-3" />
            Last optimized
          </p>
          <p className="font-medium mt-1">{lastOptimizedLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border bg-muted/30 px-2.5 py-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <MessageSquare className="size-3" />
              Interactions
            </div>
            <div className="font-medium mt-1">{interactionCount.toLocaleString()}</div>
          </div>
          <div className="rounded-md border bg-muted/30 px-2.5 py-2">
            <div className="text-muted-foreground flex items-center gap-1">
              <Activity className="size-3" />
              Versions
            </div>
            <div className="font-medium mt-1">{totalVersions}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
