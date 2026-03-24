"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, TrendingUp, Zap } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { UpgradeCTA } from "./upgrade-cta"

interface ShadowConversationSample {
  input: string
  currentOutput: string
  improvedOutput?: string
}

interface ShadowModeData {
  potentialImprovement: number
  sampleConversation?: ShadowConversationSample
}

export interface ShadowModeTeaserProps {
  webletId: string
  shadowData?: ShadowModeData
  onEnableClick?: () => void
}

const DEFAULT_SHADOW_DATA: ShadowModeData = {
  potentialImprovement: 0.24,
  sampleConversation: {
    input: "Can you summarize this customer complaint and suggest a response?",
    currentOutput:
      "The customer is upset about delivery delay. You can apologize and offer support.",
    improvedOutput:
      "Locked preview: RSIL would provide a concise sentiment summary and a brand-safe response draft with clear next steps.",
  },
}

function formatPercent(value: number): number {
  const clamped = Math.max(0, Math.min(1, value))
  return Math.round(clamped * 100)
}

function ShadowModeTeaser({ webletId, shadowData, onEnableClick }: ShadowModeTeaserProps) {
  const [fetchedShadowData, setFetchedShadowData] = useState<ShadowModeData | null>(null)

  useEffect(() => {
    if (shadowData) {
      return
    }

    let isMounted = true

    async function loadShadowData() {
      try {
        const response = await fetch(`/api/rsil/shadow?webletId=${encodeURIComponent(webletId)}`)

        if (!response.ok) {
          return
        }

        const data = (await response.json()) as ShadowModeData
        if (isMounted && typeof data?.potentialImprovement === "number") {
          setFetchedShadowData(data)
        }
      } catch {
        if (isMounted) {
          setFetchedShadowData(null)
        }
      }
    }

    void loadShadowData()

    return () => {
      isMounted = false
    }
  }, [shadowData, webletId])

  const data = useMemo(() => shadowData ?? fetchedShadowData ?? DEFAULT_SHADOW_DATA, [fetchedShadowData, shadowData])

  const improvementPercent = formatPercent(data.potentialImprovement)
  const sample = data.sampleConversation ?? DEFAULT_SHADOW_DATA.sampleConversation
  const isStrongSignal = improvementPercent >= 20

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-b from-background to-primary/5">
      <CardHeader>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="space-y-2"
        >
          <CardTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Shadow Mode Insights
          </CardTitle>
          <CardDescription>
            RSIL is currently disabled for this weblet. Here is what it could improve before you turn it on.
          </CardDescription>
        </motion.div>
      </CardHeader>

      <CardContent className="space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="grid gap-3 md:grid-cols-2"
        >
          <div className="rounded-lg border bg-background/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Estimated Impact
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              RSIL could improve <span className="text-primary">{improvementPercent}%</span> of your responses
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on recent shadow analysis across your current conversation patterns.
            </p>
          </div>

          <div className="rounded-lg border bg-background/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Zap className="h-4 w-4 text-amber-500" />
              Potential Lift Areas
            </div>
            <ul className="space-y-1 text-sm text-foreground/90">
              <li>• Better consistency in long-form answers</li>
              <li>• Stronger intent handling for nuanced prompts</li>
              <li className={cn("transition-colors", isStrongSignal ? "text-emerald-600" : "text-muted-foreground")}>
                • Confidence signal: {isStrongSignal ? "high" : "moderate"}
              </li>
            </ul>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="relative overflow-hidden rounded-xl border bg-muted/30"
        >
          <div className="grid gap-0 md:grid-cols-2">
            <div className="p-4 md:border-r">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt</p>
              <p className="mt-2 text-sm text-foreground/90">{sample?.input}</p>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Output</p>
              <p className="mt-2 text-sm text-foreground/80 blur-[1px]">{sample?.currentOutput}</p>
            </div>

            <div className="relative p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">RSIL Enhanced (Preview)</p>
              <p className="mt-2 text-sm text-foreground/70 blur-sm">{sample?.improvedOutput ?? DEFAULT_SHADOW_DATA.sampleConversation?.improvedOutput}</p>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-background/45 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-4">
            <span className="rounded-full border border-primary/30 bg-background/90 px-3 py-1 text-xs font-medium text-primary shadow-sm">
              Unlock full optimization with RSIL
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15, ease: "easeOut" }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-muted-foreground">
            Enable RSIL to convert these shadow insights into live improvements for this weblet.
          </p>
          <UpgradeCTA variant="primary" source="shadow-mode-teaser" onClick={onEnableClick} />
        </motion.div>
      </CardContent>
    </Card>
  )
}

export { ShadowModeTeaser }
