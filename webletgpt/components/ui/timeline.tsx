"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const timelineVariants = cva("flex flex-col", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row",
    },
    color: {
      primary: "[--timeline-color:var(--primary)]",
      secondary: "[--timeline-color:var(--muted-foreground)]",
      muted: "[--timeline-color:var(--muted)]",
    },
  },
  defaultVariants: {
    orientation: "vertical",
    color: "secondary",
  },
})

type TimelineProps = Omit<React.HTMLAttributes<HTMLOListElement>, "color"> &
  VariantProps<typeof timelineVariants>

function Timeline({ className, orientation, color, ...props }: TimelineProps) {
  return (
    <ol
      data-slot="timeline"
      className={cn(timelineVariants({ orientation, color }), className)}
      {...props}
    />
  )
}

function TimelineItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      data-slot="timeline-item"
      className={cn("group relative pb-8 pl-12 last:pb-0", className)}
      {...props}
    />
  )
}

function TimelineHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="timeline-header"
      className={cn(
        "absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center",
        className
      )}
      {...props}
    />
  )
}

function TimelineSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="timeline-separator"
      className={cn(
        "bg-border group-last:hidden w-px grow",
        className
      )}
      {...props}
    />
  )
}

function TimelineIcon({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="timeline-icon"
      className={cn(
        "z-10 flex shrink-0 items-center justify-center rounded-full bg-[color:var(--timeline-color)] ring-4 ring-background",
        className
      )}
      {...props}
    />
  )
}

function TimelineBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="timeline-body"
      className={cn("text-sm", className)}
      {...props}
    />
  )
}

export {
  Timeline,
  TimelineItem,
  TimelineHeader,
  TimelineSeparator,
  TimelineIcon,
  TimelineBody,
}
