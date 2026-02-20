"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, CreditCard, Bot } from "lucide-react"

interface Subscription {
  id: string
  webletName: string
  price: string
  status: "Active" | "Past Due" | "Canceled"
  nextBillingDate: string
}

const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: "1", webletName: "Codebot 3000", price: "$10.00 / month", status: "Active", nextBillingDate: "Renews on Mar 14" },
  { id: "2", webletName: "Marketing Guru", price: "$15.00 / month", status: "Active", nextBillingDate: "Renews on Mar 21" },
  { id: "3", webletName: "Data Wizard", price: "$8.00 / month", status: "Past Due", nextBillingDate: "Payment failed" },
]

export default function BillingPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS)
  const [cancelId, setCancelId] = useState<string | null>(null)

  const handleCancel = () => {
    if (cancelId) {
      setSubscriptions((prev) =>
        prev.map((sub) => (sub.id === cancelId ? { ...sub, status: "Canceled" as const, nextBillingDate: "Canceled" } : sub))
      )
      setCancelId(null)
    }
  }

  const statusColor = (status: Subscription["status"]) => {
    switch (status) {
      case "Active": return "bg-primary/10 text-primary border-primary/20"
      case "Past Due": return "bg-chart-5/10 text-chart-5 border-chart-5/20"
      case "Canceled": return "bg-muted text-muted-foreground border-border"
    }
  }

  const isEmpty = subscriptions.length === 0

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Billing & Subscriptions</h1>
          <p className="text-sm text-muted-foreground">Manage your active Weblet subscriptions.</p>
        </div>

        {isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <CardTitle className="mb-1 text-foreground">No active subscriptions</CardTitle>
                <CardDescription>{"You don't have any active Weblet subscriptions."}</CardDescription>
              </div>
              <Button asChild>
                <Link href="/marketplace">Explore the Marketplace</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Active Subscriptions</CardTitle>
              <CardDescription>Your current Weblet subscriptions and billing information.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Weblet</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium text-foreground">{sub.webletName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-foreground">{sub.price}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor(sub.status)}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{sub.nextBillingDate}</TableCell>
                      <TableCell>
                        {sub.status !== "Canceled" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Subscription actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setCancelId(sub.id)}
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

      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? You will lose access at the end of your billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
