"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, Star } from "lucide-react"

const CATEGORIES = [
  "WRITING", "CODE", "DATA_ANALYSIS", "MARKETING", "EDUCATION",
  "CUSTOMER_SUPPORT", "RESEARCH", "CREATIVE", "PRODUCTIVITY",
  "FINANCE", "HEALTH", "LEGAL", "OTHER",
]

const MOCK_WEBLETS = [
  { slug: "codebot-3000", name: "Codebot 3000", icon: "CB", developer: "Alex", rating: 4.8, category: "CODE", description: "Your ultimate coding companion. Writes, reviews, and debugs code in any language.", price: 0 },
  { slug: "marketing-wizard", name: "Marketing Wizard", icon: "MW", developer: "Sarah", rating: 4.6, category: "MARKETING", description: "Generate compelling ad copy, social media content, and full marketing strategies.", price: 15 },
  { slug: "data-analyst-pro", name: "Data Analyst Pro", icon: "DA", developer: "Mike", rating: 4.9, category: "DATA_ANALYSIS", description: "Upload your data and get instant insights, charts, and actionable recommendations.", price: 10 },
  { slug: "essay-helper", name: "Essay Helper", icon: "EH", developer: "Priya", rating: 4.3, category: "WRITING", description: "Helps students and professionals write clear, well-structured essays and reports.", price: 0 },
  { slug: "finance-advisor", name: "Finance Advisor", icon: "FA", developer: "Jordan", rating: 4.7, category: "FINANCE", description: "Personal finance guidance, budgeting help, and investment education.", price: 5 },
  { slug: "legal-assistant", name: "Legal Assistant", icon: "LA", developer: "Casey", rating: 4.5, category: "LEGAL", description: "Draft contracts, understand legal jargon, and get research assistance.", price: 20 },
  { slug: "health-coach", name: "Health Coach", icon: "HC", developer: "Drew", rating: 4.4, category: "HEALTH", description: "Nutrition guidance, workout planning, and wellness tracking support.", price: 8 },
  { slug: "research-buddy", name: "Research Buddy", icon: "RB", developer: "Taylor", rating: 4.6, category: "RESEARCH", description: "Searches the web for the latest papers, articles, and summarizes findings.", price: 0 },
]

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [pricingFilter, setPricingFilter] = useState<string[]>([])

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const togglePricing = (p: string) => {
    setPricingFilter((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const filtered = MOCK_WEBLETS.filter((w) => {
    const matchesSearch = searchQuery === "" ||
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(w.category)
    const matchesPricing =
      pricingFilter.length === 0 ||
      (pricingFilter.includes("Free") && w.price === 0) ||
      (pricingFilter.includes("Paid") && w.price > 0)
    return matchesSearch && matchesCategory && matchesPricing
  })

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Discover the best AI Agents tailored for you.
          </h1>
          <div className="relative mx-auto mt-6 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search Weblets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-56">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Categories</h3>
              <div className="flex flex-col gap-2">
                {CATEGORIES.map((cat) => (
                  <label key={cat} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <Checkbox
                      checked={selectedCategories.includes(cat)}
                      onCheckedChange={() => toggleCategory(cat)}
                    />
                    {cat.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
              <div className="my-4 h-px bg-border" />
              <h3 className="mb-3 text-sm font-semibold text-foreground">Pricing</h3>
              <div className="flex flex-col gap-2">
                {["Free", "Paid"].map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <Checkbox
                      checked={pricingFilter.includes(p)}
                      onCheckedChange={() => togglePricing(p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
                <p className="text-lg font-medium text-foreground">No Weblets found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery ? `No results for "${searchQuery}". Try a different search.` : "Try adjusting your filters."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((weblet) => (
                  <Link key={weblet.slug} href={`/marketplace/weblet/${weblet.slug}`}>
                    <Card className="h-full transition-colors hover:border-primary/30 hover:shadow-sm">
                      <CardContent className="flex flex-col gap-3 p-5">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 rounded-lg">
                            <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                              {weblet.icon}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-foreground">{weblet.name}</p>
                            <p className="text-xs text-muted-foreground">by {weblet.developer}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            <span className="font-medium text-foreground">{weblet.rating}</span>
                          </div>
                        </div>
                        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{weblet.description}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{weblet.category.replace(/_/g, " ")}</Badge>
                          <Badge variant={weblet.price === 0 ? "outline" : "default"} className="ml-auto text-[10px]">
                            {weblet.price === 0 ? "Free" : `$${weblet.price}/mo`}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
