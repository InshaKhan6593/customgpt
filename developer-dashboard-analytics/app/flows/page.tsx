"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Play, Pencil, Trash2, ArrowRight } from "lucide-react"

interface Flow {
  id: string
  name: string
  description: string
  steps: string[]
}

const MOCK_FLOWS: Flow[] = [
  {
    id: "flow-1",
    name: "Research to Article",
    description: "Research a topic deeply then produce a polished long-form article.",
    steps: ["ResearchBot", "WriterBot"],
  },
  {
    id: "flow-2",
    name: "Code Review Pipeline",
    description: "Analyze code for bugs, suggest improvements, then write unit tests.",
    steps: ["CodeAnalyzer", "Codebot 3000", "TestWriter"],
  },
  {
    id: "flow-3",
    name: "Marketing Content",
    description: "Generate marketing copy from product briefs and optimize for SEO.",
    steps: ["CopywriterAI", "SEO Optimizer"],
  },
]

export default function FlowsPage() {
  const [flows, setFlows] = useState(MOCK_FLOWS)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleDelete = () => {
    if (deleteTarget) {
      setFlows((prev) => prev.filter((f) => f.id !== deleteTarget))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn userName="Jane Doe" userEmail="jane@example.com" />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My AI Workflows</h1>
            <p className="text-sm text-muted-foreground">
              Chain multiple Weblets together into automated flows
            </p>
          </div>
          <Button asChild>
            <Link href="/flows/builder/new">
              <Plus className="mr-2 h-4 w-4" />
              Create New Flow
            </Link>
          </Button>
        </div>

        {flows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="mb-2 text-lg font-medium text-foreground">No workflows yet</p>
              <p className="mb-6 text-sm text-muted-foreground">
                Create your first flow to chain AI agents together
              </p>
              <Button asChild>
                <Link href="/flows/builder/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Flow
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flows.map((flow) => (
              <Card key={flow.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-foreground">{flow.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{flow.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-1">
                    {flow.steps.map((step, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {step}
                        </Badge>
                        {i < flow.steps.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="flex-1">
                      <Play className="mr-1 h-3 w-3" />
                      Run
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/flows/builder/${flow.id}`}>
                        <Pencil className="h-3 w-3" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(flow.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
