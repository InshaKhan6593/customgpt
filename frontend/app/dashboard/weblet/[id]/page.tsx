"use client"

import { useState } from "react"
import Link from "next/link"
import { NavHeader } from "@/components/nav-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  Pencil,
  CheckCircle2,
  X,
  Loader2,
  ChevronDown,
  Coins,
  Zap,
} from "lucide-react"
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// Mock data
const DAILY_CHATS = Array.from({ length: 14 }, (_, i) => ({
  day: `Feb ${i + 1}`,
  chats: Math.floor(Math.random() * 300 + 200),
}))

const REVENUE_HISTORY = Array.from({ length: 14 }, (_, i) => ({
  day: `Feb ${i + 1}`,
  revenue: Math.floor(Math.random() * 150 + 50),
}))

const CREDIT_USAGE = Array.from({ length: 14 }, (_, i) => ({
  day: `Feb ${i + 1}`,
  model: Math.floor(Math.random() * 200 + 100),
  tools: Math.floor(Math.random() * 80 + 20),
}))

const TOPICS = ["Next.js deployment", "React hooks", "TypeScript generics", "API design", "Database queries", "CSS Grid", "Authentication", "Caching strategies"]

const SUGGESTIONS = [
  { id: "1", issue: "The AI gave dangerous advice and scored 2.6/5.0.", proposedChange: "Add a safety guardrail: 'Never provide medical, legal, or financial advice. Always recommend consulting a professional.'", status: "pending" as const },
  { id: "2", issue: "Users report repetitive opening lines scoring 3.1/5.0.", proposedChange: "Vary the greeting based on context. Replace static opener with: 'Based on your question about {topic}, here is my analysis...'", status: "pending" as const },
  { id: "3", issue: "Code output lacks error handling, scored 3.4/5.0.", proposedChange: "Add instruction: 'Always include try-catch blocks and proper error handling in code examples.'", status: "completed" as const },
]

const REFLECTION_LOGS = Array.from({ length: 10 }, (_, i) => ({
  id: `log-${i}`,
  date: `Feb ${20 - i}, 2026`,
  score: (Math.random() * 2 + 3).toFixed(1),
  decision: ["None", "Suggestion", "Auto-Update"][Math.floor(Math.random() * 3)],
  evaluation: `Evaluated ${Math.floor(Math.random() * 50 + 10)} interactions. The agent performed ${Math.random() > 0.5 ? "above" : "below"} average in code accuracy. Identified ${Math.floor(Math.random() * 3)} areas for improvement including response formatting and technical depth.`,
}))

const SUBSCRIBERS = [
  { email: "alice@example.com", date: "Jan 12, 2026", status: "Active" },
  { email: "bob@example.com", date: "Jan 20, 2026", status: "Active" },
  { email: "charlie@example.com", date: "Feb 3, 2026", status: "Active" },
  { email: "diana@example.com", date: "Feb 14, 2026", status: "Canceled" },
]

const EXECUTION_LOGS = [
  { sessionId: "sess_a1b2", date: "Feb 20, 2026 14:32", userId: "user_x9k2", latency: "1.2s" },
  { sessionId: "sess_c3d4", date: "Feb 20, 2026 13:18", userId: "user_m4n8", latency: "2.8s" },
  { sessionId: "sess_e5f6", date: "Feb 19, 2026 22:01", userId: "user_p2q7", latency: "0.9s" },
  { sessionId: "sess_g7h8", date: "Feb 19, 2026 18:45", userId: "user_r1s3", latency: "3.4s" },
]

const TRACE_STEPS = [
  { label: "System Prompt", content: "You are Codebot 3000, an expert coding assistant. Always provide working, production-ready code with error handling.", type: "system" },
  { label: "User Message", content: "How do I implement authentication in Next.js?", type: "user" },
  { label: "Tool Call: WebSearch", content: '{"query": "Next.js authentication best practices 2026", "results": 3}', type: "tool" },
  { label: "Tool Response", content: "Found 3 results: 1. Auth.js documentation, 2. Next.js middleware guide, 3. Session management patterns", type: "tool-response" },
  { label: "LLM Response", content: "Here is a complete guide to implementing authentication in Next.js using Auth.js (NextAuth v5)...", type: "assistant" },
]

const chartConfig = {
  chats: { label: "Chats", color: "var(--color-chart-1)" },
  revenue: { label: "Revenue ($)", color: "var(--color-chart-2)" },
  model: { label: "Model Credits", color: "var(--color-chart-1)" },
  tools: { label: "Tool Credits", color: "var(--color-chart-3)" },
}

export default function WebletDashboardPage() {
  const [suggestionStates, setSuggestionStates] = useState<Record<string, "pending" | "loading" | "completed" | "dismissed">>(
    Object.fromEntries(SUGGESTIONS.map((s) => [s.id, s.status]))
  )
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [autoReload, setAutoReload] = useState(false)

  const handleApproveSuggestion = (id: string) => {
    setSuggestionStates((prev) => ({ ...prev, [id]: "loading" }))
    setTimeout(() => {
      setSuggestionStates((prev) => ({ ...prev, [id]: "completed" }))
    }, 2000)
  }

  const handleDismissSuggestion = (id: string) => {
    setSuggestionStates((prev) => ({ ...prev, [id]: "dismissed" }))
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader isLoggedIn />
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Codebot 3000</h1>
              <Badge>Active</Badge>
            </div>
            <Link href="/builder/codebot">
              <Button variant="outline" size="sm" className="gap-2">
                <Pencil className="h-3.5 w-3.5" />
                Edit in Builder
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-6 w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rsil">RSIL Inbox</TabsTrigger>
            <TabsTrigger value="monetization">Monetization</TabsTrigger>
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
            <TabsTrigger value="credits">Credits</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Chat Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={DAILY_CHATS}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" className="text-xs" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="chats" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Latest Chat Topics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((topic) => (
                      <Badge key={topic} variant="secondary" className="text-xs">{topic}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Category Rank</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">#4</div>
                    <div>
                      <p className="font-medium text-foreground">Rank #4 in Code</p>
                      <p className="text-sm text-muted-foreground">Based on chat volume and user ratings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RSIL Tab */}
          <TabsContent value="rsil" className="flex flex-col gap-6">
            {/* Active A/B Test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active A/B Test</CardTitle>
                <CardDescription>Comparing prompt versions for optimal performance.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Control (V2)</Badge>
                      <span className="text-xs text-muted-foreground">50% traffic</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-2xl font-bold text-foreground">4.6</span>
                      <span className="text-sm text-muted-foreground">/ 5.0 avg rating</span>
                    </div>
                  </div>
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <Badge>Challenger (V3)</Badge>
                      <span className="text-xs text-muted-foreground">50% traffic</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-2xl font-bold text-foreground">4.8</span>
                      <span className="text-sm text-muted-foreground">/ 5.0 avg rating</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm">Deploy Winner</Button>
                  <Button size="sm" variant="outline">End Test</Button>
                </div>
              </CardContent>
            </Card>

            {/* Suggestions Inbox */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suggestions Inbox</CardTitle>
                <CardDescription>AI-generated improvements based on user feedback.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {SUGGESTIONS.map((s) => {
                  const state = suggestionStates[s.id]
                  return (
                    <div key={s.id} className={`rounded-lg border p-4 ${state === "completed" ? "border-success/30 bg-success/5" : state === "dismissed" ? "border-border bg-muted opacity-60" : "border-border"}`}>
                      <p className="text-sm font-medium text-foreground">{s.issue}</p>
                      <div className="mt-2 rounded-md bg-muted p-3">
                        <p className="text-xs font-medium text-muted-foreground">Proposed Update:</p>
                        <p className="mt-1 text-sm text-foreground">{s.proposedChange}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {state === "pending" && (
                          <>
                            <Button size="sm" onClick={() => handleApproveSuggestion(s.id)}>Approve & A/B Test</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDismissSuggestion(s.id)}>Dismiss</Button>
                          </>
                        )}
                        {state === "loading" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Building A/B test...
                          </div>
                        )}
                        {state === "completed" && (
                          <div className="flex items-center gap-2 text-sm text-success">
                            <CheckCircle2 className="h-4 w-4" />
                            A/B Test Active
                          </div>
                        )}
                        {state === "dismissed" && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <X className="h-4 w-4" />
                            Dismissed
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Reflection Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reflection Logs</CardTitle>
                <CardDescription>Automated evaluation history.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Date</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {REFLECTION_LOGS.map((log) => (
                      <Collapsible key={log.id} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-accent">
                              <TableCell>
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                              <TableCell className="text-muted-foreground">{log.date}</TableCell>
                              <TableCell>
                                <span className={`font-medium ${Number(log.score) >= 4 ? "text-success" : Number(log.score) >= 3 ? "text-warning-foreground" : "text-destructive"}`}>
                                  {log.score}/5.0
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[10px]">{log.decision}</Badge>
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow>
                              <TableCell colSpan={4} className="bg-muted/50 p-4">
                                <p className="text-sm leading-relaxed text-muted-foreground">{log.evaluation}</p>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monetization Tab */}
          <TabsContent value="monetization" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subscriber List</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Subscription Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SUBSCRIBERS.map((sub) => (
                      <TableRow key={sub.email}>
                        <TableCell className="font-medium text-foreground">{sub.email}</TableCell>
                        <TableCell className="text-muted-foreground">{sub.date}</TableCell>
                        <TableCell>
                          <Badge variant={sub.status === "Active" ? "default" : "secondary"} className="text-[10px]">{sub.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue History</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={REVENUE_HISTORY}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" className="text-xs" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line dataKey="revenue" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Execution Logs Tab */}
          <TabsContent value="logs" className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Sessions</CardTitle>
                <CardDescription>Powered by Langfuse observability.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EXECUTION_LOGS.map((log) => (
                      <TableRow key={log.sessionId}>
                        <TableCell className="font-mono text-xs text-foreground">{log.sessionId}</TableCell>
                        <TableCell className="text-muted-foreground">{log.date}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{log.userId}</TableCell>
                        <TableCell className="text-muted-foreground">{log.latency}</TableCell>
                        <TableCell>
                          <Dialog open={selectedSession === log.sessionId} onOpenChange={(open) => setSelectedSession(open ? log.sessionId : null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">View Trace</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Session Trace: {log.sessionId}</DialogTitle>
                                <DialogDescription>{log.date} | Latency: {log.latency}</DialogDescription>
                              </DialogHeader>
                              <ScrollArea className="max-h-[60vh]">
                                <div className="flex flex-col gap-0 pl-4">
                                  {TRACE_STEPS.map((step, i) => (
                                    <div key={i} className="relative border-l-2 border-border pb-4 pl-6 last:border-l-0">
                                      <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-border bg-card" />
                                      <div className="rounded-lg border border-border p-3">
                                        <div className="flex items-center gap-2">
                                          <Badge variant={
                                            step.type === "system" ? "secondary" :
                                            step.type === "user" ? "default" :
                                            step.type === "tool" ? "outline" :
                                            step.type === "tool-response" ? "outline" :
                                            "default"
                                          } className="text-[10px]">
                                            {step.label}
                                          </Badge>
                                        </div>
                                        <p className={`mt-2 text-sm leading-relaxed ${step.type === "tool" || step.type === "tool-response" ? "font-mono text-xs" : ""} text-muted-foreground`}>
                                          {step.content}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credits Tab */}
          <TabsContent value="credits" className="flex flex-col gap-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Current Balance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                      <Coins className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-foreground">4,500</p>
                      <p className="text-sm text-muted-foreground">Available Platform Credits</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-reload Credits</Label>
                      <p className="text-xs text-muted-foreground">Auto-reload when balance falls below 1,000.</p>
                    </div>
                    <Switch checked={autoReload} onCheckedChange={setAutoReload} />
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full gap-2">
                        <Zap className="h-4 w-4" />
                        Buy More Credits
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Purchase Credits</DialogTitle>
                        <DialogDescription>Select a package to top up your credits.</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-3 pt-2">
                        {[
                          { credits: "5,000", price: "$10" },
                          { credits: "30,000", price: "$50" },
                          { credits: "70,000", price: "$100" },
                        ].map((pkg) => (
                          <Button key={pkg.price} variant="outline" className="h-auto justify-between p-4">
                            <span className="font-semibold">{pkg.credits} Credits</span>
                            <Badge>{pkg.price}</Badge>
                          </Button>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Credit Usage (14 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={CREDIT_USAGE}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="day" className="text-xs" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="model" fill="var(--color-chart-1)" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="tools" fill="var(--color-chart-3)" stackId="a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
