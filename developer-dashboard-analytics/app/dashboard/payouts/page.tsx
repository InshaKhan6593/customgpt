"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DollarSign, ArrowLeft } from "lucide-react"
import { ClientOnly } from "@/components/client-only"

const MOCK_HISTORY = [
  { date: "2026-02-10", amount: "$150.00", status: "Completed" as const, email: "jane.dev@paypal.com" },
  { date: "2026-01-15", amount: "$200.00", status: "Completed" as const, email: "jane.dev@paypal.com" },
  { date: "2025-12-20", amount: "$85.00", status: "Completed" as const, email: "jane.dev@paypal.com" },
  { date: "2025-11-28", amount: "$50.00", status: "Failed" as const, email: "jane.old@paypal.com" },
  { date: "2025-11-10", amount: "$120.00", status: "Completed" as const, email: "jane.dev@paypal.com" },
]

type PayoutStatus = "Pending" | "Processing" | "Completed" | "Failed"

function StatusBadge({ status }: { status: PayoutStatus }) {
  const styles: Record<PayoutStatus, string> = {
    Pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-700",
    Processing: "border-blue-500/30 bg-blue-500/10 text-blue-700",
    Completed: "border-primary/30 bg-primary/10 text-primary",
    Failed: "border-destructive/30 bg-destructive/10 text-destructive",
  }

  return (
    <Badge variant="outline" className={styles[status]}>
      {status}
    </Badge>
  )
}

export default function PayoutsPage() {
  const [paypalEmail, setPaypalEmail] = useState("jane.dev@paypal.com")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [history, setHistory] = useState(MOCK_HISTORY)
  const availableBalance = 284.50
  const minPayout = 50.0

  const canPayout = availableBalance >= minPayout && paypalEmail.includes("@")

  const handleConfirmPayout = () => {
    setHistory((prev) => [
      {
        date: new Date().toISOString().split("T")[0],
        amount: `$${availableBalance.toFixed(2)}`,
        status: "Pending" as const,
        email: paypalEmail,
      },
      ...prev,
    ])
    setShowConfirmDialog(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Payouts</h1>
          <p className="text-sm text-muted-foreground">Withdraw your earnings to PayPal</p>
        </div>

        {/* Balance Card */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-foreground">Available Balance</CardTitle>
                <CardDescription>Minimum payout is $50.00</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-4xl font-bold text-foreground">
              ${availableBalance.toFixed(2)}
            </p>
            <ClientOnly
              fallback={<div className="h-10 w-full rounded-md border border-input bg-background" />}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label htmlFor="paypal-email" className="text-foreground">
                    PayPal Email Address
                  </Label>
                  <Input
                    id="paypal-email"
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="your-email@paypal.com"
                    className="mt-1.5"
                  />
                </div>
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={!canPayout}
                  className="shrink-0"
                >
                  Request Payout
                </Button>
              </div>
            </ClientOnly>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Payout History</CardTitle>
            <CardDescription>Your past withdrawal requests</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">PayPal Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-foreground">{row.date}</TableCell>
                    <TableCell className="font-medium text-foreground">{row.amount}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {row.email}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm Withdrawal</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw ${availableBalance.toFixed(2)} to{" "}
              <strong className="text-foreground">{paypalEmail}</strong>? Transfers take 3-5 business days.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPayout}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
