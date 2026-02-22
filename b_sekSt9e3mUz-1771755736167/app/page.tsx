"use client"

import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Bot, Code, Store, ArrowRight } from "lucide-react"

export default function HomePage() {
  // Logged-out state — no user prop
  return (
    <div className="min-h-svh bg-background">
      <NavHeader />

      {/* Hero */}
      <main className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-20 pb-16 text-center">
        <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Build, Share & Chat with AI Agents
        </h1>
        <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
          WebletGPT is the platform where developers build and monetize AI agents (Weblets) and users chat with them. Get started in minutes.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Button asChild size="lg">
            <Link href="/login">
              Get Started
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/marketplace">Explore Marketplace</Link>
          </Button>
        </div>
      </main>

      {/* Features */}
      <section className="border-t bg-accent/30 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground mb-12">
            Everything you need to build AI
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="size-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Chat with AI Agents</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Discover and interact with powerful AI agents built by the community.
              </p>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Code className="size-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Visual Builder</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Build custom AI agents with our intuitive visual builder. No coding required.
              </p>
            </div>
            <div className="flex flex-col items-center text-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                <Store className="size-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Marketplace</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Publish your creations to the marketplace and reach thousands of users.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
          WebletGPT. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
