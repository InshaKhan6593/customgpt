"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Loader2, ChevronDown } from "lucide-react"

interface Suggestion {
  id: string
  issue: string
  score: string
  proposedUpdate: string
  status: "pending" | "approved" | "dismissed"
}

const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    id: "1",
    issue: "The AI gave dangerous advice and scored 2.6/5.0.",
    score: "2.6/5.0",
    proposedUpdate: "Update system prompt to include explicit safety disclaimers when discussing code security topics. Add guardrails for code injection patterns.",
    status: "pending",
  },
  {
    id: "2",
    issue: "Users report outdated API references, scored 3.1/5.0.",
    score: "3.1/5.0",
    proposedUpdate: "Refresh knowledge base with latest Next.js 16 documentation and deprecate references to getServerSideProps in favor of server components.",
    status: "pending",
  },
]

const MOCK_LOGS = [
  { date: "2026-02-20", score: "4.2/5.0", decision: "None", text: "Overall performance is within acceptable parameters. No optimization needed at this time." },
  { date: "2026-02-19", score: "3.8/5.0", decision: "Suggestion", text: "Detected a pattern of user dissatisfaction with code security responses. Generated a suggestion to add safety disclaimers." },
  { date: "2026-02-18", score: "4.5/5.0", decision: "None", text: "Strong performance across all interaction categories. No action required." },
  { date: "2026-02-17", score: "2.9/5.0", decision: "Auto-Update", text: "Critical drop in code accuracy scores. Auto-deployed fix to improve TypeScript type inference responses." },
]

export function WebletRsilTab() {
  const [suggestions, setSuggestions] = useState(MOCK_SUGGESTIONS)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleApprove = async (id: string) => {
    setLoadingId(id)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "approved" as const } : s))
    )
    setLoadingId(null)
  }

  const handleDismiss = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "dismissed" as const } : s))
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Active A/B Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Active A/B Test</CardTitle>
          <CardDescription>Comparing prompt versions for optimal performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="secondary">Control (V2)</Badge>
                <span className="text-sm text-muted-foreground">50% traffic</span>
              </div>
              <p className="text-2xl font-bold text-foreground">4.3<span className="text-sm font-normal text-muted-foreground">/5.0</span></p>
              <p className="text-xs text-muted-foreground">Based on 1,240 interactions</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <Badge className="bg-primary text-primary-foreground">Challenger (V3)</Badge>
                <span className="text-sm text-muted-foreground">50% traffic</span>
              </div>
              <p className="text-2xl font-bold text-foreground">4.6<span className="text-sm font-normal text-muted-foreground">/5.0</span></p>
              <p className="text-xs text-muted-foreground">Based on 1,180 interactions</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button>Deploy Winner</Button>
            <Button variant="outline">End Test</Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions Inbox */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Suggestions Inbox</CardTitle>
          <CardDescription>AI-generated optimization recommendations for your system prompt</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="outline" className={
                  suggestion.status === "approved"
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : suggestion.status === "dismissed"
                    ? "bg-muted text-muted-foreground"
                    : "border-chart-5/20 bg-chart-5/10 text-chart-5"
                }>
                  {suggestion.status === "pending" ? suggestion.score : suggestion.status}
                </Badge>
              </div>
              <p className="mb-2 text-sm text-foreground">{suggestion.issue}</p>
              <div className="mb-3 rounded-md bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Proposed Update:</p>
                <p className="mt-1 text-sm text-foreground">{suggestion.proposedUpdate}</p>
              </div>
              {suggestion.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApprove(suggestion.id)} disabled={!!loadingId}>
                    {loadingId === suggestion.id ? (
                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Approving...</>
                    ) : (
                      "Approve & A/B Test"
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismiss(suggestion.id)}>Dismiss</Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reflection Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Reflection Logs</CardTitle>
          <CardDescription>Last 50 automated evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead className="w-8"><span className="sr-only">Expand</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_LOGS.map((log, i) => (
                <Collapsible key={i} asChild>
                  <>
                    <TableRow>
                      <TableCell className="text-foreground">{log.date}</TableCell>
                      <TableCell className="text-foreground">{log.score}</TableCell>
                      <TableCell>
                        <Badge variant={log.decision === "Auto-Update" ? "default" : log.decision === "Suggestion" ? "secondary" : "outline"}>
                          {log.decision}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={4} className="bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                          {log.text}
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
