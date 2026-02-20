"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters"
import { WebletGrid } from "@/components/marketplace/weblet-grid"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { ClientOnly } from "@/components/client-only"

export interface MarketplaceWeblet {
  slug: string
  name: string
  developerName: string
  rating: number
  category: string
  description: string
  price: string
  icon: string
}

const ALL_WEBLETS: MarketplaceWeblet[] = [
  { slug: "codebot-3000", name: "Codebot 3000", developerName: "Jane Doe", rating: 4.8, category: "CODE", description: "Full-stack coding assistant that helps you write, debug, and review code with context-aware suggestions.", price: "$5/mo", icon: "CB" },
  { slug: "research-pro", name: "ResearchBot Pro", developerName: "Alex Kim", rating: 4.6, category: "RESEARCH", description: "Deep research agent that synthesizes multiple sources into concise, citation-rich reports.", price: "Free", icon: "RP" },
  { slug: "copywriter-ai", name: "CopywriterAI", developerName: "Sam Wright", rating: 4.5, category: "MARKETING", description: "Generate high-converting marketing copy, social media posts, and ad variations in seconds.", price: "$8/mo", icon: "CA" },
  { slug: "data-cruncher", name: "DataCruncher", developerName: "Maria Chen", rating: 4.7, category: "DATA_ANALYSIS", description: "Analyze datasets, generate charts, and extract insights with natural language queries.", price: "$10/mo", icon: "DC" },
  { slug: "tutor-ai", name: "TutorAI", developerName: "Lee Park", rating: 4.9, category: "EDUCATION", description: "Personalized learning companion that adapts to your pace and breaks down complex topics.", price: "Free", icon: "TA" },
  { slug: "legal-helper", name: "Legal Helper", developerName: "Chris Fong", rating: 4.3, category: "LEGAL", description: "Draft contracts, review legal documents, and get plain-language explanations of legal terms.", price: "$15/mo", icon: "LH" },
  { slug: "creative-muse", name: "Creative Muse", developerName: "Nia Johnson", rating: 4.4, category: "CREATIVE", description: "Brainstorm ideas, write stories, compose poems, and generate creative content on demand.", price: "Free", icon: "CM" },
  { slug: "seo-optimizer", name: "SEO Optimizer", developerName: "Dave Mills", rating: 4.2, category: "MARKETING", description: "Optimize your content for search engines with keyword analysis and on-page SEO recommendations.", price: "$7/mo", icon: "SO" },
  { slug: "finance-advisor", name: "Finance Advisor", developerName: "Priya Sharma", rating: 4.6, category: "FINANCE", description: "Personal finance guidance, budget analysis, and investment insights tailored to your goals.", price: "$12/mo", icon: "FA" },
  { slug: "health-coach", name: "Health Coach", developerName: "Tom Brady", rating: 4.1, category: "HEALTH", description: "Wellness tips, meal planning, and fitness routines adapted to your lifestyle and goals.", price: "Free", icon: "HC" },
  { slug: "support-bot", name: "SupportBot", developerName: "Jenny Liu", rating: 4.5, category: "CUSTOMER_SUPPORT", description: "Instant customer support agent that handles FAQs, tickets, and escalation workflows.", price: "$20/mo", icon: "SB" },
  { slug: "writer-bot", name: "WriterBot", developerName: "Max Stone", rating: 4.7, category: "WRITING", description: "Professional writing assistant for articles, blogs, reports, and documentation with style customization.", price: "$6/mo", icon: "WB" },
]

const CATEGORIES = [
  "WRITING", "CODE", "DATA_ANALYSIS", "MARKETING", "EDUCATION",
  "CUSTOMER_SUPPORT", "RESEARCH", "CREATIVE", "PRODUCTIVITY", "FINANCE",
  "HEALTH", "LEGAL", "OTHER",
]

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedPricing, setSelectedPricing] = useState<string[]>([])

  const filteredWeblets = useMemo(() => {
    return ALL_WEBLETS.filter((w) => {
      const matchesSearch =
        !searchQuery ||
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(w.category)

      const matchesPricing =
        selectedPricing.length === 0 ||
        (selectedPricing.includes("Free") && w.price === "Free") ||
        (selectedPricing.includes("Paid") && w.price !== "Free")

      return matchesSearch && matchesCategory && matchesPricing
    })
  }, [searchQuery, selectedCategories, selectedPricing])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const togglePricing = (pricing: string) => {
    setSelectedPricing((prev) =>
      prev.includes(pricing) ? prev.filter((p) => p !== pricing) : [...prev, pricing]
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />

      {/* Hero Section */}
      <section className="border-b border-border bg-muted/30 px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-3 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Discover the best AI Agents tailored for you
          </h1>
          <p className="mb-6 text-muted-foreground">
            Browse hundreds of specialized AI agents built by the community
          </p>
          <div className="relative mx-auto max-w-lg">
            <ClientOnly
              fallback={
                <div className="h-10 w-full rounded-md border border-input bg-background" />
              }
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents..."
                className="pl-9"
              />
            </ClientOnly>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8">
        {/* Sidebar Filters */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <MarketplaceFilters
            categories={CATEGORIES}
            selectedCategories={selectedCategories}
            toggleCategory={toggleCategory}
            selectedPricing={selectedPricing}
            togglePricing={togglePricing}
          />
        </aside>

        {/* Grid */}
        <main className="flex-1">
          <WebletGrid weblets={filteredWeblets} searchQuery={searchQuery} />
        </main>
      </div>
    </div>
  )
}
