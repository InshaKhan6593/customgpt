"use client"

import { useEffect, useState, useCallback } from "react"
import { Bot, MoreVertical, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"

interface UserPlan {
  tier: string
  creditsIncluded: number
  creditsUsed: number
  billingCycleEnd: string | null
}

interface Subscription {
  id: string
  stripeSubscriptionId: string | null
  status: string
  currentPeriodEnd: string | null
}

export default function BillingPage() {
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelSubId, setCancelSubId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [planRes, subRes] = await Promise.all([
        fetch("/api/billing/plans"),
        fetch("/api/subscriptions"),
      ])
      const planData = await planRes.json()
      const subData = await subRes.json()
      setUserPlan(planData.userPlan ?? null)
      setSubscriptions(subData.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const availableCredits = userPlan
    ? Math.max(0, userPlan.creditsIncluded - userPlan.creditsUsed)
    : 0

  const handleCancelSub = async () => {
    if (!cancelSubId) return
    setCancelling(true)
    try {
      await fetch("/api/stripe/customer-portal", { method: "POST" })
        .then((r) => r.json())
        .then((d) => { if (d.url) window.location.href = d.url })
    } finally {
      setCancelling(false)
      setCancelSubId(null)
    }
  }

  const statusVariant = (status: string) => {
    if (status === "ACTIVE") return "default"
    if (status === "PAST_DUE" || status === "UNPAID") return "destructive"
    return "secondary"
  }

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
          <p className="text-muted-foreground mt-2">
            Manage your platform credits and active weblet subscriptions.
          </p>
        </div>
        <Button
          onClick={async () => {
            try {
              const res = await fetch("/api/stripe/customer-portal", { method: "POST" })
              const data = await res.json()
              if (data.url) window.location.href = data.url
              else alert(data.error || "No active billing account found.")
            } catch {
              alert("Something went wrong.")
            }
          }}
          variant="outline"
        >
          Manage Billing on Stripe
        </Button>
      </div>

      {/* Platform Credits */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Platform Credits</CardTitle>
            <CardDescription>
              Used for paying LLM execution costs on free or usage-based weblets.
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              <div className="text-3xl font-bold">{availableCredits.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Available Credits
                {userPlan && (
                  <> &middot; Plan: <span className="font-medium">{userPlan.tier}</span></>
                )}
                {userPlan?.creditsIncluded && (
                  <> &middot; {userPlan.creditsUsed.toLocaleString()} / {userPlan.creditsIncluded.toLocaleString()} used</>
                )}
              </p>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" asChild>
            <a href="/dashboard/billing">Upgrade Plan</a>
          </Button>
        </CardFooter>
      </Card>

      {/* Weblet Subscriptions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Subscriptions</h2>

        {loading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : subscriptions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <CardTitle className="mb-2">No Active Subscriptions</CardTitle>
            <CardDescription className="mb-6 max-w-sm">
              You don&apos;t have any active Weblet subscriptions.
            </CardDescription>
            <Button asChild>
              <a href="/marketplace">Explore the Marketplace</a>
            </Button>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Weblet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renews</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      {"Weblet Subscription"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(sub.status)}>
                        {sub.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.currentPeriodEnd
                        ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onClick={() => setCancelSubId(sub.id)}
                            disabled={sub.status === "CANCELED"}
                          >
                            Cancel Subscription
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelSubId} onOpenChange={(open) => !open && setCancelSubId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will open the Stripe billing portal where you can cancel your subscription.
              You will keep access until the end of your current billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelSub}
              disabled={cancelling}
            >
              {cancelling ? "Redirecting…" : "Manage on Stripe"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
