"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  Save,
  Rocket,
  Loader2,
  Send,
  RotateCcw,
  Upload,
  Trash2,
  FileText,
  Bot,
} from "lucide-react"

const CATEGORIES = [
  "WRITING", "CODE", "DATA_ANALYSIS", "MARKETING", "EDUCATION",
  "CUSTOMER_SUPPORT", "RESEARCH", "CREATIVE", "PRODUCTIVITY",
  "FINANCE", "HEALTH", "LEGAL", "OTHER",
]

type UploadedFile = { name: string; size: string; progress: number }

type PreviewMessage = { id: string; role: "user" | "assistant"; content: string }

export default function BuilderPage() {
  const [webletName, setWebletName] = useState("Untitled Weblet")
  const [status] = useState<"Draft" | "Active">("Draft")
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // Configuration Tab
  const [category, setCategory] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [subscribersOnly, setSubscribersOnly] = useState(false)

  // Capabilities Tab
  const [webSearch, setWebSearch] = useState(false)
  const [codeInterpreter, setCodeInterpreter] = useState(false)
  const [imageGeneration, setImageGeneration] = useState(false)

  // Knowledge Base Tab
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // RSIL Tab
  const [rsilEnabled, setRsilEnabled] = useState(false)
  const [minInteractions, setMinInteractions] = useState(100)
  const [optimizationFrequency, setOptimizationFrequency] = useState("Weekly")
  const [maxUpdatesPerDay, setMaxUpdatesPerDay] = useState(3)
  const [cooldownHours, setCooldownHours] = useState(6)
  const [requireApproval, setRequireApproval] = useState(false)

  // Preview
  const [previewMessages, setPreviewMessages] = useState<PreviewMessage[]>([])
  const [previewInput, setPreviewInput] = useState("")
  const [previewStreaming, setPreviewStreaming] = useState(false)
  const [pendingChanges, setPendingChanges] = useState(false)

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => { setIsSaving(false); setPendingChanges(false) }, 1200)
  }

  const handlePublish = () => {
    setIsPublishing(true)
    setTimeout(() => setIsPublishing(false), 2000)
  }

  const handleFileUpload = () => {
    const file: UploadedFile = {
      name: `document_${uploadedFiles.length + 1}.pdf`,
      size: `${(Math.random() * 5 + 0.5).toFixed(1)} MB`,
      progress: 0,
    }
    setUploadedFiles((prev) => [...prev, file])
    // Simulate progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 20
      setUploadedFiles((prev) =>
        prev.map((f) => (f.name === file.name ? { ...f, progress: Math.min(progress, 100) } : f))
      )
      if (progress >= 100) clearInterval(interval)
    }, 300)
  }

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name))
  }

  const handlePreviewSend = () => {
    if (!previewInput.trim() || previewStreaming) return
    const userMsg: PreviewMessage = { id: Date.now().toString(), role: "user", content: previewInput }
    setPreviewMessages((prev) => [...prev, userMsg])
    setPreviewInput("")
    setPreviewStreaming(true)
    setTimeout(() => {
      setPreviewMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "This is a preview response. In production, this would use your configured system prompt and capabilities to generate a real response.",
      }])
      setPreviewStreaming(false)
    }, 1500)
  }

  const markDirty = () => setPendingChanges(true)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Nav */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Input
            value={webletName}
            onChange={(e) => { setWebletName(e.target.value); markDirty() }}
            className="h-8 w-48 border-transparent bg-transparent font-semibold hover:border-border focus:border-border"
          />
          <Badge variant={status === "Draft" ? "secondary" : "default"} className="text-xs">{status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Save Draft
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={isPublishing}>
            {isPublishing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-2 h-3.5 w-3.5" />}
            Publish Weblet
          </Button>
        </div>
      </header>

      {/* Split Pane */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Pane - Configuration */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <div className="flex h-full flex-col">
            <Tabs defaultValue="configuration" className="flex flex-1 flex-col">
              <div className="border-b border-border px-4">
                <TabsList className="h-10 w-full justify-start bg-transparent p-0">
                  <TabsTrigger value="configuration" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Configuration</TabsTrigger>
                  <TabsTrigger value="capabilities" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Capabilities</TabsTrigger>
                  <TabsTrigger value="knowledge" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Knowledge</TabsTrigger>
                  <TabsTrigger value="rsil" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">Optimization</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-5">
                  <TabsContent value="configuration" className="mt-0 flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <Label>Category</Label>
                      <Select value={category} onValueChange={(v) => { setCategory(v); markDirty() }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Agent Instructions / System Prompt</Label>
                      <Textarea
                        value={systemPrompt}
                        onChange={(e) => { setSystemPrompt(e.target.value); markDirty() }}
                        placeholder="You are a helpful assistant..."
                        rows={10}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <Label>Subscribers Only</Label>
                        <p className="text-xs text-muted-foreground">Require a paid subscription to access this Weblet.</p>
                      </div>
                      <Switch checked={subscribersOnly} onCheckedChange={(v) => { setSubscribersOnly(v); markDirty() }} />
                    </div>
                  </TabsContent>

                  <TabsContent value="capabilities" className="mt-0 flex flex-col gap-4">
                    {[
                      { label: "Web Search", desc: "Allow this agent to search the live web for current information", checked: webSearch, onChange: setWebSearch },
                      { label: "Code Interpreter", desc: "Allow this agent to write and execute Python code in a secure sandbox", checked: codeInterpreter, onChange: setCodeInterpreter },
                      { label: "Image Generation", desc: "Allow this agent to generate images using DALL-E 3", checked: imageGeneration, onChange: setImageGeneration },
                    ].map((cap) => (
                      <div key={cap.label} className="flex items-center justify-between rounded-lg border border-border p-4">
                        <div className="flex-1 pr-4">
                          <Label>{cap.label}</Label>
                          <p className="text-xs text-muted-foreground">{cap.desc}</p>
                        </div>
                        <Switch checked={cap.checked} onCheckedChange={(v) => { cap.onChange(v); markDirty() }} />
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="knowledge" className="mt-0 flex flex-col gap-4">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); handleFileUpload() }}
                      className="cursor-pointer rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
                      role="button"
                      tabIndex={0}
                      aria-label="Upload files"
                    >
                      <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                      <p className="font-medium text-foreground">Drag & drop files or click to upload</p>
                      <p className="mt-1 text-xs text-muted-foreground">Accepts .pdf, .docx, .txt, .csv</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt,.csv"
                        onChange={handleFileUpload}
                      />
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {uploadedFiles.map((file) => (
                          <div key={file.name} className="flex items-center gap-3 rounded-lg border border-border p-3">
                            <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{file.size}</p>
                              {file.progress < 100 && (
                                <Progress value={file.progress} className="mt-1.5 h-1.5" />
                              )}
                            </div>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeFile(file.name)} aria-label={`Delete ${file.name}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="rsil" className="mt-0 flex flex-col gap-5">
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <Label>Enable Automatic Prompt Optimization (RSIL)</Label>
                        <p className="text-xs text-muted-foreground">Automatically improve your agent based on user feedback.</p>
                      </div>
                      <Switch checked={rsilEnabled} onCheckedChange={setRsilEnabled} />
                    </div>
                    {rsilEnabled && (
                      <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                        <div className="flex flex-col gap-2">
                          <Label>Min Interactions Before Optimize</Label>
                          <Input type="number" value={minInteractions} onChange={(e) => setMinInteractions(Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Optimization Frequency</Label>
                          <Select value={optimizationFrequency} onValueChange={setOptimizationFrequency}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Daily">Daily</SelectItem>
                              <SelectItem value="Weekly">Weekly</SelectItem>
                              <SelectItem value="Manual">Manual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Max Updates Per Day</Label>
                          <Input type="number" value={maxUpdatesPerDay} onChange={(e) => setMaxUpdatesPerDay(Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label>Cooldown Hours</Label>
                          <Input type="number" value={cooldownHours} onChange={(e) => setCooldownHours(Number(e.target.value))} />
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Require Developer Approval</Label>
                            <p className="text-xs text-muted-foreground">All automated improvements will be sent as Suggestions instead of auto-deploying.</p>
                          </div>
                          <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Pane - Live Preview */}
        <ResizablePanel defaultSize={55} minSize={30}>
          <div className="flex h-full flex-col">
            <div className="flex h-12 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Live Preview Mode</span>
              </div>
              {pendingChanges && (
                <Badge variant="outline" className="text-xs text-warning-foreground border-warning/30 bg-warning/10">Changes pending</Badge>
              )}
            </div>

            {/* Preview Messages */}
            <ScrollArea className="flex-1 px-4 py-4">
              {previewMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Test your Weblet here</p>
                  <p className="text-xs text-muted-foreground">Send a message to see how your agent responds.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {previewMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-border bg-card text-foreground"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {previewStreaming && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3">
                        <span className="flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Preview Input */}
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setPreviewMessages([])}
                  aria-label="Clear preview"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Input
                  value={previewInput}
                  onChange={(e) => setPreviewInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handlePreviewSend() }}
                  placeholder="Test your agent..."
                  disabled={previewStreaming}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handlePreviewSend}
                  disabled={!previewInput.trim() || previewStreaming}
                  aria-label="Send preview message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
