import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Zap, Bot, BarChart3, Shield } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn={false} />
      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 py-24 text-center lg:px-8 lg:py-32">
            <div className="mx-auto max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>AI Agent Platform for Builders</span>
              </div>
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Build, Deploy & Monetize AI Agents
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
                The platform where developers create powerful AI Weblets and users discover, chat with, and subscribe to them. No-code builder, marketplace, and analytics in one place.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link href="/login">
                  <Button size="lg" className="px-8">Get Started Free</Button>
                </Link>
                <Link href="/marketplace">
                  <Button size="lg" variant="outline" className="px-8">Explore Marketplace</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: Bot,
                  title: "No-Code Builder",
                  description: "Create sophisticated AI agents with a visual builder. Configure system prompts, capabilities, and knowledge bases without writing code."
                },
                {
                  icon: BarChart3,
                  title: "Analytics & RSIL",
                  description: "Track performance with detailed analytics. Our Recursive Self-Improving Loop optimizes your agents automatically."
                },
                {
                  icon: Shield,
                  title: "Monetize Your Work",
                  description: "Set subscription prices, manage payouts, and grow your revenue. Built-in Stripe integration handles everything."
                }
              ].map((feature) => (
                <div key={feature.title} className="flex flex-col gap-3 rounded-xl border border-border bg-background p-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
