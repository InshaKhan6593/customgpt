"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export function GeneralSettings() {
  const [name, setName] = useState("Jane Doe")
  const [isSaving, setIsSaving] = useState(false)
  const [nameError, setNameError] = useState("")

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setNameError("")

    if (name.length > 50) {
      setNameError("Display name must be 50 characters or less.")
      return
    }

    setIsSaving(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">General Settings</CardTitle>
        <CardDescription>Manage your account profile information.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              type="text"
              placeholder="e.g., Jane Doe"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError("")
              }}
              maxLength={50}
              aria-invalid={!!nameError}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email-address">Email Address</Label>
            <Input
              id="email-address"
              type="email"
              value="jane@example.com"
              disabled
              readOnly
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Your email cannot be changed.</p>
          </div>

          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
