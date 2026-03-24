"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const ringVariants = cva("", {
  variants: {
    size: {
      sm: "w-20 h-20",
      md: "w-32 h-32",
      lg: "w-48 h-48",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

type Tier = "bronze" | "silver" | "gold" | "platinum"

interface HealthProgressRingProps extends VariantProps<typeof ringVariants> {
  score: number
  tier: Tier
  className?: string
}

const TIER_CONFIG: Record<Tier, { label: string; badgeClass: string }> = {
  bronze: {
    label: "Bronze",
    badgeClass: "bg-amber-700/10 text-amber-700 border-amber-700/20",
  },
  silver: {
    label: "Silver",
    badgeClass: "bg-slate-400/10 text-slate-400 border-slate-400/20",
  },
  gold: {
    label: "Gold",
    badgeClass: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  platinum: {
    label: "Platinum",
    badgeClass: "bg-cyan-400/10 text-cyan-400 border-cyan-400/20",
  },
}

const SIZE_CONFIG = {
  sm: { strokeWidth: 3, radius: 28, fontSize: "text-xs", badgeSize: "text-[8px]" },
  md: { strokeWidth: 5, radius: 50, fontSize: "text-xl", badgeSize: "text-xs" },
  lg: { strokeWidth: 7, radius: 90, fontSize: "text-4xl", badgeSize: "text-sm" },
}

function getScoreColor(score: number): string {
  const SCORE_THRESHOLD_YELLOW = 0.5
  const SCORE_THRESHOLD_GREEN = 0.7
  
  if (score < SCORE_THRESHOLD_YELLOW) return "stroke-red-500"
  if (score < SCORE_THRESHOLD_GREEN) return "stroke-yellow-500"
  return "stroke-green-500"
}

function HealthProgressRing({
  score,
  tier,
  size = "md",
  className,
}: HealthProgressRingProps) {
  const MIN_SCORE = 0
  const MAX_SCORE = 1
  const clampedScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, score))
  
  const sizeConfig = SIZE_CONFIG[size ?? "md"]
  const { strokeWidth, radius, fontSize, badgeSize } = sizeConfig
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - clampedScore)
  
  const scoreColor = getScoreColor(clampedScore)
  const tierConfig = TIER_CONFIG[tier]
  
  const strokePadding = strokeWidth
  const viewBoxSize = (radius + strokePadding) * 2
  const center = viewBoxSize / 2

  return (
    <div className={cn("relative inline-flex items-center justify-center", ringVariants({ size }), className)}>
      <svg
        className="transform -rotate-90"
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={scoreColor}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{
            duration: 1,
            ease: "easeOut",
            delay: 0.1,
          }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className={cn("font-bold tabular-nums", fontSize)}
        >
          {Math.round(clampedScore * 100)}%
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <Badge
            variant="outline"
            className={cn(tierConfig.badgeClass, badgeSize, "px-1.5 py-0.5")}
          >
            {tierConfig.label}
          </Badge>
        </motion.div>
      </div>
    </div>
  )
}

export { HealthProgressRing, type HealthProgressRingProps, type Tier }
