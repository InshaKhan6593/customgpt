import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NavHeader } from "@/components/nav-header"
import { Bot, Code, TrendingUp, Zap } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center lg:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            AI Agent Marketplace
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Build, Deploy & Monetize AI Agents
          </h1>
          <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
            WebletGPT is the platform where developers create intelligent AI agents and users discover them. Build once, earn forever.
          </p>
          <div className="flex items-center gap-3">
            <Button size="lg" asChild>
              <Link href="/marketplace">Explore Marketplace</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Start Building</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border bg-muted/50 px-4 py-20">
          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No-Code Builder</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Configure AI agents with a visual studio. Set system prompts, enable capabilities, and upload knowledge bases.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Code className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Self-Improving AI</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                RSIL technology automatically optimizes your agents based on real user feedback and interaction data.
              </p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Monetize Your Agents</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Set subscription pricing, track revenue, and withdraw earnings to PayPal. Your AI, your income.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
