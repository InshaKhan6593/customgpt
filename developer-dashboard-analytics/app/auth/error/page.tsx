"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { NavHeader } from "@/components/nav-header"
import { AlertTriangle } from "lucide-react"

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "This login link has expired or is invalid.",
  Default: "An unexpected authentication error occurred.",
}

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error") || "Default"
  const message = errorMessages[error] || errorMessages.Default

  return (
    <Card className="w-full max-w-md border-destructive/50">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle className="text-2xl font-bold text-foreground">Authentication Error</CardTitle>
        <CardDescription className="mt-2 text-destructive">{message}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" asChild>
          <Link href="/login">Back to Login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader />
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
        <Suspense fallback={
          <Card className="w-full max-w-md border-destructive/50">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-foreground">Loading...</CardTitle>
            </CardHeader>
          </Card>
        }>
          <AuthErrorContent />
        </Suspense>
      </main>
    </div>
  )
}
