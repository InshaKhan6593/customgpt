import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface WebletCardProps {
  weblet: {
    id: string
    name: string
    compositeScore?: number | null
    status: 'active' | 'pending'
  }
  onClick?: () => void
}

export function WebletCard({ weblet, onClick }: WebletCardProps) {
  const { name, compositeScore, status } = weblet
  const scoreDisplay = compositeScore != null ? compositeScore.toFixed(1) : '—'
  const isActive = status === 'active'

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        onClick && 'active:scale-[0.98]',
      )}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">{name}</CardTitle>
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
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{scoreDisplay}</div>
          <div className="text-xs text-muted-foreground">composite score</div>
        </div>
      </CardContent>
    </Card>
  )
}
