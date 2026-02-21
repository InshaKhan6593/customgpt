"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, DollarSign, Loader2 } from "lucide-react"

const PAYOUT_HISTORY = [
  { id: "1", date: "Feb 1, 2026", amount: "$420.00", status: "Completed", email: "dev@paypal.com" },
  { id: "2", date: "Jan 15, 2026", amount: "$180.00", status: "Completed", email: "dev@paypal.com" },
  { id: "3", date: "Jan 1, 2026", amount: "$310.00", status: "Completed", email: "dev@paypal.com" },
  { id: "4", date: "Dec 15, 2025", amount: "$75.00", status: "Failed", email: "old@paypal.com" },
  { id: "5", date: "Dec 1, 2025", amount: "$200.00", status: "Pending", email: "dev@paypal.com" },
]

export default function PayoutsPage() {
  const [paypalEmail, setPaypalEmail] = useState("dev@paypal.com")
  const [balance] = useState(280.5)
  const [isRequesting, setIsRequesting] = useState(false)
  const minPayout = 50

  const handleRequestPayout = () => {
    setIsRequesting(true)
    setTimeout(() => setIsRequesting(false), 2000)
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "Completed": return "bg-success/10 text-success border-success/20"
      case "Pending": return "bg-warning/10 text-warning-foreground border-warning/20"
      case "Processing": return "bg-primary/10 text-primary border-primary/20"
      case "Failed": return "bg-destructive/10 text-destructive border-destructive/20"
      default: return ""
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
        <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="mb-8 mt-3 text-2xl font-semibold tracking-tight text-foreground">Developer Payouts</h1>

        {/* Balance Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Available Balance</CardTitle>
            <CardDescription>Minimum payout is $50.00.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <DollarSign className="h-7 w-7 text-primary" />
              </div>
              <p className="text-4xl font-bold text-foreground">${balance.toFixed(2)}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="paypal">PayPal Email Address</Label>
              <Input
                id="paypal"
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="your@paypal.com"
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={balance < minPayout || !paypalEmail} className="w-fit">
                  Request Payout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Payout Request</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to withdraw ${balance.toFixed(2)} to {paypalEmail}? Transfers take 3-5 business days.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRequestPayout} disabled={isRequesting}>
                    {isRequesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Confirm"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PayPal Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PAYOUT_HISTORY.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{p.date}</TableCell>
                    <TableCell className="font-medium text-foreground">{p.amount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(p.status)}>{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
