import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-destructive/30 shadow-sm">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Authentication Error</CardTitle>
          <CardDescription className="mt-2 leading-relaxed">
            This login link has expired or is invalid. Please request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-2">
          <Link href="/login">
            <Button>Back to Login</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
