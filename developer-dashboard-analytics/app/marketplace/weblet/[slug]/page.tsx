"use client"

import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { WebletPricingCard } from "@/components/weblet-pricing-card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star, MessageSquare, Globe, Code, ImageIcon, ArrowLeft } from "lucide-react"
import { formatNumber } from "@/lib/utils"

// Mock data for a single weblet -- would come from API in production
const WEBLET = {
  slug: "codebot-3000",
  name: "Codebot 3000",
  developerName: "Jane Doe",
  icon: "CB",
  rating: 4.8,
  totalChats: 12430,
  categories: ["CODE", "PRODUCTIVITY"],
  capabilities: ["web_search", "code_interpreter"],
  price: 5,
  isFree: false,
  description: `## About Codebot 3000

Codebot 3000 is a full-stack coding assistant that helps you write, debug, and review code with context-aware suggestions.

### What it can do

- **Write code** from natural language descriptions in any language
- **Debug issues** by analyzing error messages and stack traces
- **Review pull requests** with actionable feedback
- **Generate tests** for existing codebases
- **Explain concepts** with examples tailored to your experience level

### Who it's for

Developers of all skill levels who want a reliable AI pair programmer that understands modern frameworks and best practices.`,
}

const CAPABILITY_MAP: Record<string, { icon: React.ReactNode; label: string }> = {
  web_search: { icon: <Globe className="h-4 w-4" />, label: "Web Search" },
  code_interpreter: { icon: <Code className="h-4 w-4" />, label: "Code Interpreter" },
  image_generation: { icon: <ImageIcon className="h-4 w-4" />, label: "Image Generation" },
}

export default function WebletLandingPage() {
  const isFree = WEBLET.isFree

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          href="/marketplace"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Marketplace
        </Link>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left Column: Details */}
          <div className="flex-1">
            {/* Header */}
            <div className="mb-6 flex items-start gap-4">
              <Avatar className="h-16 w-16 shrink-0">
                <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
                  {WEBLET.icon}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{WEBLET.name}</h1>
                <p className="text-sm text-muted-foreground">
                  by {WEBLET.developerName}
                </p>
              </div>
            </div>

            {/* Description (Markdown rendered as HTML) */}
            <div className="prose prose-sm max-w-none text-foreground mb-8">
              {WEBLET.description.split("\n").map((line, i) => {
                if (line.startsWith("## ")) {
                  return (
                    <h2 key={i} className="mb-3 mt-6 text-xl font-bold text-foreground">
                      {line.replace("## ", "")}
                    </h2>
                  )
                }
                if (line.startsWith("### ")) {
                  return (
                    <h3 key={i} className="mb-2 mt-4 text-lg font-semibold text-foreground">
                      {line.replace("### ", "")}
                    </h3>
                  )
                }
                if (line.startsWith("- ")) {
                  const content = line.replace("- ", "")
                  const hasBold = content.match(/\*\*(.+?)\*\*/)
                  if (hasBold) {
                    const parts = content.split(/\*\*(.+?)\*\*/)
                    return (
                      <li key={i} className="ml-4 text-sm text-muted-foreground">
                        {parts[0]}<strong className="text-foreground">{parts[1]}</strong>{parts[2]}
                      </li>
                    )
                  }
                  return (
                    <li key={i} className="ml-4 text-sm text-muted-foreground">
                      {content}
                    </li>
                  )
                }
                if (line.trim() === "") return <div key={i} className="h-2" />
                return (
                  <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                    {line}
                  </p>
                )
              })}
            </div>

            {/* Categories */}
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {WEBLET.categories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div className="mb-6">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Capabilities</h3>
              <div className="flex flex-wrap gap-2">
                {WEBLET.capabilities.map((cap) => {
                  const mapped = CAPABILITY_MAP[cap]
                  if (!mapped) return null
                  return (
                    <Badge key={cap} variant="outline" className="flex items-center gap-1.5 text-xs">
                      {mapped.icon}
                      {mapped.label}
                    </Badge>
                  )
                })}
              </div>
            </div>

            {/* Metrics */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Metrics</h3>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {formatNumber(WEBLET.totalChats)} chats
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm text-foreground">{WEBLET.rating}/5.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Action Card */}
          <div className="w-full shrink-0 lg:w-80">
            {isFree ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground">Free to Use</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Start chatting with {WEBLET.name} right away -- no subscription required.
                  </p>
                  <Button className="w-full" asChild>
                    <Link href={`/chat/${WEBLET.slug}`}>Start Chatting Now</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <WebletPricingCard
                webletName={WEBLET.name}
                price={WEBLET.price}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
