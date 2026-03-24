'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Crown, Medal, Shield, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { type AchievementTier } from '@/hooks/use-rsil-tier'

export interface AchievementBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tier: AchievementTier
  size?: 'sm' | 'md' | 'lg'
  showProgress?: boolean
  nextTierProgress?: number
}

const TIER_CONFIG = {
  bronze: {
    icon: Shield,
    label: 'Bronze',
    colors: 'text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-500 dark:border-amber-500/30',
    progressColors: 'bg-amber-500/20 [&_[data-slot=progress-indicator]]:bg-amber-500',
    glow: 'hover:shadow-[0_0_12px_rgba(245,158,11,0.2)]',
    animate: false,
  },
  silver: {
    icon: Medal,
    label: 'Silver',
    colors: 'text-slate-700 bg-slate-500/10 border-slate-500/20 dark:text-slate-300 dark:border-slate-500/30',
    progressColors: 'bg-slate-500/20 [&_[data-slot=progress-indicator]]:bg-slate-500',
    glow: 'hover:shadow-[0_0_12px_rgba(148,163,184,0.2)]',
    animate: false,
  },
  gold: {
    icon: Trophy,
    label: 'Gold',
    colors: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20 dark:text-yellow-500 dark:border-yellow-500/30',
    progressColors: 'bg-yellow-500/20 [&_[data-slot=progress-indicator]]:bg-yellow-500',
    glow: 'hover:shadow-[0_0_12px_rgba(234,179,8,0.2)] shadow-[0_0_8px_rgba(234,179,8,0.15)]',
    animate: true,
  },
  platinum: {
    icon: Crown,
    label: 'Platinum',
    colors: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30',
    progressColors: 'bg-cyan-500/20 [&_[data-slot=progress-indicator]]:bg-cyan-500',
    glow: 'hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] shadow-[0_0_10px_rgba(6,182,212,0.2)]',
    animate: true,
  },
}

const SIZE_CONFIG = {
  sm: {
    badge: 'text-xs px-2 py-0.5',
    icon: 'size-3.5',
    gap: 'gap-1',
  },
  md: {
    badge: 'text-sm px-2.5 py-1',
    icon: 'size-4',
    gap: 'gap-1.5',
  },
  lg: {
    badge: 'text-base px-3 py-1.5',
    icon: 'size-5',
    gap: 'gap-2',
  },
}

export function AchievementBadge({
  tier,
  size = 'md',
  showProgress = false,
  nextTierProgress = 0,
  className,
  ...props
}: AchievementBadgeProps) {
  const config = TIER_CONFIG[tier]
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = config.icon

  // Clamp progress between 0 and 1
  const progress = Math.min(Math.max(nextTierProgress, 0), 1)

  return (
    <div className={cn('inline-flex flex-col gap-2', className)} {...props}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 5 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0,
          ...(config.animate && {
            boxShadow: [
              '0 0 8px rgba(234,179,8,0.15)',
              '0 0 16px rgba(234,179,8,0.25)',
              '0 0 8px rgba(234,179,8,0.15)',
            ],
          }),
        }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 25,
          mass: 0.8,
          boxShadow: config.animate ? {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          } : undefined,
        }}
        key={tier}
      >
        <Badge
          variant="outline"
          className={cn(
            'transition-all duration-300',
            sizeConfig.badge,
            sizeConfig.gap,
            config.colors,
            config.glow,
            'border cursor-default'
          )}
        >
          <Icon className={cn(sizeConfig.icon)} />
          {config.label}
        </Badge>
      </motion.div>
      
      {showProgress && tier !== 'platinum' && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex flex-col gap-1 w-full"
        >
          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-0.5 font-medium">
            <span>Next Tier</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <Progress 
            value={progress * 100} 
            className={cn("h-1.5 w-full", config.progressColors)} 
          />
        </motion.div>
      )}
    </div>
  )
}
