"use client"

import { useState } from "react"
import { Bot, MoreVertical, Plus } from "lucide-react"

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Mock Data
const MOCK_CREDITS = 500
const MOCK_SUBSCRIPTIONS = [
  {
    id: "sub_1",
    webletName: "Essay Editor",
    price: 8.0,
    status: "Active",
    nextBillingDate: "Oct 14, 2024",
  },
  {
    id: "sub_2",
    webletName: "Code Reviewer",
    price: 15.0,
    status: "Past Due",
    nextBillingDate: "Past Due",
  },
]

export default function BillingPage() {
  const [subscriptions, setSubscriptions] = useState(MOCK_SUBSCRIPTIONS)
  const [cancelSubId, setCancelSubId] = useState<string | null>(null)
  
  // Handlers
  const handleCancelSub = () => {
    if (cancelSubId) {
      // Future: Call API to cancel Stripe Subscription
      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === cancelSubId ? { ...sub, status: "Canceled", nextBillingDate: "Ends at term" } : sub
        )
      )
      setCancelSubId(null)
    }
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
        <Button onClick={async () => {
          try {
            const res = await fetch("/api/stripe/customer-portal", { method: "POST" })
            const data = await res.json()
            if (data.url) window.location.href = data.url
            else alert(data.error || "No active billing account found.")
          } catch (e) {
            alert("Something went wrong.")
          }
        }} variant="outline">
          Manage Billing on Stripe
        </Button>
      </div>

      {/* Top Card: Platform Credits */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Platform Credits</CardTitle>
            <CardDescription>
              Used for paying LLM execution costs on free or usage-based weblets.
            </CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Buy Credits
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Purchase Platform Credits</DialogTitle>
                <DialogDescription>
                  Select a credit package to add to your balance.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <Button variant="outline" className="h-24 flex flex-col gap-2">
                  <span className="font-bold text-lg">500 Credits</span>
                  <span className="text-muted-foreground">$5.00</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col gap-2">
                  <span className="font-bold text-lg">1,200 Credits</span>
                  <span className="text-muted-foreground">$10.00</span>
                </Button>
              </div>
              <DialogFooter>
                <Button className="w-full">Proceed to Checkout</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{MOCK_CREDITS.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">Available Credits</p>
        </CardContent>
      </Card>

      {/* Subscriptions Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Active Subscriptions</h2>
        
        {subscriptions.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <CardTitle className="mb-2">No Active Subscriptions</CardTitle>
            <CardDescription className="mb-6 max-w-sm">
              You don't have any active Weblet subscriptions.
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
                  <TableHead>Weblet Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Billing Date</TableHead>
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
                      {sub.webletName}
                    </TableCell>
                    <TableCell>${sub.price.toFixed(2)} / month</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          sub.status === "Active"
                            ? "default"
                            : sub.status === "Past Due"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sub.nextBillingDate}
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
                            disabled={sub.status === "Canceled"}
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancelSubId} onOpenChange={(open) => !open && setCancelSubId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will cancel your subscription. You will lose access to the premium features of this Weblet at the end of your current billing cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCancelSub}
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
