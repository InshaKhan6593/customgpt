import { NavHeader } from "@/components/nav-header"

export default function MarketplacePage() {
  return (
    <div className="min-h-svh bg-background">
      <NavHeader />
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">Marketplace</h1>
        <p className="text-muted-foreground">Discover AI agents built by the community. Coming soon.</p>
      </div>
    </div>
  )
}
