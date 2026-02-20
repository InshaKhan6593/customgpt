"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface MarketplaceFiltersProps {
  categories: string[]
  selectedCategories: string[]
  toggleCategory: (cat: string) => void
  selectedPricing: string[]
  togglePricing: (pricing: string) => void
}

export function MarketplaceFilters({
  categories,
  selectedCategories,
  toggleCategory,
  selectedPricing,
  togglePricing,
}: MarketplaceFiltersProps) {
  return (
    <nav className="flex flex-col gap-6" aria-label="Marketplace filters">
      {/* Categories */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Categories</h3>
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <Checkbox
                id={`cat-${cat}`}
                checked={selectedCategories.includes(cat)}
                onCheckedChange={() => toggleCategory(cat)}
              />
              <Label
                htmlFor={`cat-${cat}`}
                className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              >
                {cat.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Pricing</h3>
        <div className="flex flex-col gap-2">
          {["Free", "Paid"].map((p) => (
            <div key={p} className="flex items-center gap-2">
              <Checkbox
                id={`price-${p}`}
                checked={selectedPricing.includes(p)}
                onCheckedChange={() => togglePricing(p)}
              />
              <Label
                htmlFor={`price-${p}`}
                className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              >
                {p}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </nav>
  )
}
