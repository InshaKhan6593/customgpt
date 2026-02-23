"use client"

import { Suspense, useState } from "react"
import { LoginCard } from "@/components/auth/login-card"

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <Suspense fallback={<div>Loading authentication...</div>}>
        <LoginCard />
      </Suspense>
    </div>
  )
}
