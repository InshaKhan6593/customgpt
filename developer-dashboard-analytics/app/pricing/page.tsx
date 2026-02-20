import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Simple, transparent pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Each Weblet sets its own price. Users only pay for the agents they use.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Free tier */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">For Users</CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">Free</span>
              </div>
              <p className="text-sm text-muted-foreground">Explore and chat with free Weblets</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2.5">
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  Access to all free Weblets
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  Standard model access
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  Multi-agent workflows
                </li>
              </ul>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/marketplace">Browse Marketplace</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Developer tier */}
          <Card className="relative border-primary/50">
            <div className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
              For Developers
            </div>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Developer Mode</CardTitle>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">Free</span>
              </div>
              <p className="text-sm text-muted-foreground">Build, publish, and earn</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <ul className="flex flex-col gap-2.5">
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  No-code Weblet Builder
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  RSIL auto-optimization
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  Set your own subscription pricing
                </li>
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary" />
                  Analytics dashboard
                </li>
              </ul>
              <Button className="w-full" asChild>
                <Link href="/login">Start Building</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
