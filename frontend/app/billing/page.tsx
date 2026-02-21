"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Coins, MoreHorizontal, ShoppingBag } from "lucide-react"

const CREDIT_PACKAGES = [
  { credits: 500, price: 5 },
  { credits: 1200, price: 10 },
]

const MOCK_SUBSCRIPTIONS = [
  { id: "1", name: "Data Analyst Pro", icon: "DA", price: 10, status: "Active" as const, nextBilling: "Mar 14, 2026" },
  { id: "2", name: "Marketing Wizard", icon: "MW", price: 15, status: "Active" as const, nextBilling: "Mar 20, 2026" },
  { id: "3", name: "Legal Assistant", icon: "LA", price: 20, status: "Past Due" as const, nextBilling: "Feb 10, 2026" },
]

export default function BillingPage() {
  const [subscriptions, setSubscriptions] = useState(MOCK_SUBSCRIPTIONS)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [credits] = useState(500)
  const [showEmpty] = useState(false)

  const handleCancel = (id: string) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "Canceled" as const } : s))
    )
    setCancelTarget(null)
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-success/10 text-success border-success/20"
      case "Past Due": return "bg-warning/10 text-warning-foreground border-warning/20"
      case "Canceled": return "bg-muted text-muted-foreground border-border"
      default: return ""
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-foreground">Billing & Subscriptions</h1>

        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Platform Credits</CardTitle>
              <CardDescription>Credits are used for AI model usage across the platform.</CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <Coins className="h-4 w-4" />
                  Buy Credits
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Buy Platform Credits</DialogTitle>
                  <DialogDescription>Choose a credit package below.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 pt-2">
                  {CREDIT_PACKAGES.map((pkg) => (
                    <Button key={pkg.price} variant="outline" className="h-auto justify-between p-4">
                      <span className="font-semibold">{pkg.credits.toLocaleString()} Credits</span>
                      <Badge>${pkg.price}</Badge>
                    </Button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{credits.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Available Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {showEmpty || subscriptions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{"You don't have any active Weblet subscriptions."}</p>
                <p className="mt-1 text-sm text-muted-foreground">Subscribe to premium Weblets in the Marketplace.</p>
              </div>
              <Link href="/marketplace">
                <Button>Explore the Marketplace</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Weblet</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Billing</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">{sub.icon}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{sub.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">${sub.price.toFixed(2)} / month</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor(sub.status)}>{sub.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sub.status === "Canceled" ? "---" : `Renews on ${sub.nextBilling}`}
                      </TableCell>
                      <TableCell>
                        {sub.status !== "Canceled" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setCancelTarget(sub.id)}
                              >
                                Cancel Subscription
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={() => setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? You will lose access at the end of your billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancelTarget && handleCancel(cancelTarget)}
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
