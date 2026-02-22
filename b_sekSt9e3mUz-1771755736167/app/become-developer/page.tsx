"use client"

import { useState } from "react"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CheckCircle, Loader2, Hammer, Store, BarChart3, Sparkles, Coins } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/types"

import { useSession } from "next-auth/react"
const benefits = [
  { icon: Hammer, text: "Build custom AI agents (Weblets) with our visual builder" },
  { icon: Store, text: "Publish to the marketplace and reach thousands of users" },
  { icon: BarChart3, text: "Access detailed analytics and performance metrics" },
  { icon: Sparkles, text: "Configure RSIL for real-time prompt optimization" },
  { icon: Coins, text: "Monetize your creations (coming soon)" },
]

export default function BecomeDeveloperPage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [agreed, setAgreed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" />
      </div>
    )
  }

  const user = session?.user

  if (!user) {
    return null
  }

  const role = user.role

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/upgrade-role", { method: "POST" })
      if (!res.ok) throw new Error("Upgrade failed")
      await update({ role: "DEVELOPER" })
      toast.success("Your account has been upgraded to Developer!")
      router.push("/dashboard")
    } catch (error) {
      console.error(error)
      toast.error("Failed to upgrade.")
    } finally {
      setIsLoading(false)
    }
  }

  if (role === "DEVELOPER" || role === "ADMIN") {
    return (
      <div className="min-h-svh bg-background">
        <NavHeader />
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle className="size-6 text-primary" />
              </div>
              <CardTitle className="text-foreground">{"You're already a Developer!"}</CardTitle>
              <CardDescription>
                You already have access to all developer tools and features.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <NavHeader />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Become a Developer</h1>

        {/* Benefits Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-foreground">Developer Benefits</CardTitle>
            <CardDescription>
              Unlock powerful tools to build, publish, and monetize AI agents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-4">
              {benefits.map((benefit) => (
                <li key={benefit.text} className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <benefit.icon className="size-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground leading-relaxed pt-1">{benefit.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Terms & Upgrade */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  I agree to the{" "}
                  <Link
                    href="/terms/developer"
                    target="_blank"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    Developer Terms of Service
                  </Link>
                </Label>
              </div>

              <Button
                onClick={handleUpgrade}
                disabled={!agreed || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Upgrading...
                  </>
                ) : (
                  "Upgrade to Developer"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
