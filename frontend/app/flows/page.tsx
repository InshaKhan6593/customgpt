"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Plus, Play, Pencil, Trash2, ArrowRight, Workflow } from "lucide-react"

type Flow = {
  id: string
  name: string
  description: string
  steps: string[]
}

const MOCK_FLOWS: Flow[] = [
  {
    id: "flow-1",
    name: "Research & Write Pipeline",
    description: "Researches a topic thoroughly, then writes a polished blog post based on the findings.",
    steps: ["Research Buddy", "Essay Helper"],
  },
  {
    id: "flow-2",
    name: "Data to Marketing",
    description: "Analyzes raw data to extract insights, then generates marketing copy based on the results.",
    steps: ["Data Analyst Pro", "Marketing Wizard"],
  },
  {
    id: "flow-3",
    name: "Full Content Pipeline",
    description: "Researches, writes, and then reviews content for legal compliance.",
    steps: ["Research Buddy", "Essay Helper", "Legal Assistant"],
  },
]

export default function FlowsPage() {
  const [flows, setFlows] = useState(MOCK_FLOWS)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    setFlows((prev) => prev.filter((f) => f.id !== id))
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">My AI Workflows</h1>
          <Link href="/flows/builder/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create New Flow
            </Button>
          </Link>
        </div>

        {flows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Workflow className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">No workflows yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first flow to chain multiple AI agents together.
                </p>
              </div>
              <Link href="/flows/builder/new">
                <Button>Create Your First Flow</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {flows.map((flow) => (
              <Card key={flow.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{flow.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{flow.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {flow.steps.map((step, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{step}</Badge>
                        {i < flow.steps.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    <Button size="sm" className="gap-1.5">
                      <Play className="h-3 w-3" />
                      Run Flow
                    </Button>
                    <Link href={`/flows/builder/${flow.id}`}>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(flow.id)}
                      aria-label={`Delete ${flow.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The workflow and all its configuration will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
