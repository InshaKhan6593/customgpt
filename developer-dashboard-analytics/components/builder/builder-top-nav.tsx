"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2 } from "lucide-react"

interface BuilderTopNavProps {
  name: string
  onNameChange: (name: string) => void
  status: "Draft" | "Active"
  onSave: () => void
  onPublish: () => void
  isSaving: boolean
}

export function BuilderTopNav({ name, onNameChange, status, onSave, onPublish, isSaving }: BuilderTopNavProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard" aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="h-8 w-48 border-none bg-transparent text-sm font-semibold shadow-none focus-visible:ring-1 lg:w-64"
          aria-label="Weblet name"
        />
      </div>
      <div className="flex items-center gap-3">
        <Badge
          variant={status === "Active" ? "default" : "secondary"}
          className={status === "Active" ? "bg-primary text-primary-foreground" : ""}
        >
          {status}
        </Badge>
        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button size="sm" onClick={onPublish} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Publish Weblet
        </Button>
      </div>
    </header>
  )
}
