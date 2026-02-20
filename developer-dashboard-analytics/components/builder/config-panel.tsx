"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, Trash2, FileText } from "lucide-react"

const CATEGORIES = [
  "WRITING", "CODE", "DATA_ANALYSIS", "MARKETING", "EDUCATION",
  "CUSTOMER_SUPPORT", "RESEARCH", "CREATIVE", "PRODUCTIVITY",
  "FINANCE", "HEALTH", "LEGAL", "OTHER",
]

interface ConfigPanelProps {
  systemPrompt: string
  onSystemPromptChange: (prompt: string) => void
}

interface UploadedFile {
  name: string
  size: string
  progress: number
}

export function ConfigPanel({ systemPrompt, onSystemPromptChange }: ConfigPanelProps) {
  const [category, setCategory] = useState("")
  const [subscribersOnly, setSubscribersOnly] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [codeInterpreter, setCodeInterpreter] = useState(false)
  const [imageGeneration, setImageGeneration] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([
    { name: "product-docs.pdf", size: "2.4 MB", progress: 100 },
  ])
  const [rsilEnabled, setRsilEnabled] = useState(false)
  const [minInteractions, setMinInteractions] = useState(100)
  const [optimizationFreq, setOptimizationFreq] = useState("Weekly")
  const [maxUpdates, setMaxUpdates] = useState(3)
  const [cooldownHours, setCooldownHours] = useState(6)
  const [requireApproval, setRequireApproval] = useState(false)

  const handleFileUpload = () => {
    const newFile: UploadedFile = {
      name: `upload-${Date.now()}.pdf`,
      size: "1.2 MB",
      progress: 0,
    }
    setUploadedFiles((prev) => [...prev, newFile])
    // Simulate progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 20
      setUploadedFiles((prev) =>
        prev.map((f) => (f.name === newFile.name ? { ...f, progress: Math.min(progress, 100) } : f))
      )
      if (progress >= 100) clearInterval(interval)
    }, 300)
  }

  const removeFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== name))
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <Tabs defaultValue="configuration">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="configuration">Config</TabsTrigger>
            <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            <TabsTrigger value="rsil">RSIL</TabsTrigger>
          </TabsList>

          {/* Tab 1: Configuration */}
          <TabsContent value="configuration" className="flex flex-col gap-5 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="system-prompt">Agent Instructions / System Prompt</Label>
              <Textarea
                id="system-prompt"
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="You are a helpful assistant..."
                className="min-h-[200px] font-mono text-sm"
                rows={10}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="subscribers-only" className="text-sm font-medium">Subscribers Only</Label>
                <p className="text-xs text-muted-foreground">Restrict access to paying subscribers</p>
              </div>
              <Switch id="subscribers-only" checked={subscribersOnly} onCheckedChange={setSubscribersOnly} />
            </div>
          </TabsContent>

          {/* Tab 2: Capabilities */}
          <TabsContent value="capabilities" className="flex flex-col gap-4 pt-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex-1">
                <Label htmlFor="web-search" className="text-sm font-medium">Web Search</Label>
                <p className="text-xs text-muted-foreground">Allow this agent to search the live web for current information</p>
              </div>
              <Switch id="web-search" checked={webSearch} onCheckedChange={setWebSearch} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex-1">
                <Label htmlFor="code-interpreter" className="text-sm font-medium">Code Interpreter</Label>
                <p className="text-xs text-muted-foreground">Allow this agent to write and execute Python code in a secure sandbox</p>
              </div>
              <Switch id="code-interpreter" checked={codeInterpreter} onCheckedChange={setCodeInterpreter} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex-1">
                <Label htmlFor="image-gen" className="text-sm font-medium">Image Generation</Label>
                <p className="text-xs text-muted-foreground">Allow this agent to generate images using DALL-E 3</p>
              </div>
              <Switch id="image-gen" checked={imageGeneration} onCheckedChange={setImageGeneration} />
            </div>
          </TabsContent>

          {/* Tab 3: Knowledge Base */}
          <TabsContent value="knowledge" className="flex flex-col gap-4 pt-4">
            <div
              onClick={handleFileUpload}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleFileUpload()}
              aria-label="Upload files"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop files here or click to upload</p>
              <p className="text-xs text-muted-foreground">Accepts .pdf, .docx, .txt, .csv</p>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Uploaded Files</Label>
                {uploadedFiles.map((file) => (
                  <div key={file.name} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{file.size}</p>
                      {file.progress < 100 && <Progress value={file.progress} className="mt-1 h-1" />}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFile(file.name)} aria-label={`Delete ${file.name}`}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab 4: RSIL */}
          <TabsContent value="rsil" className="flex flex-col gap-4 pt-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex-1">
                <Label htmlFor="rsil-toggle" className="text-sm font-medium">Enable Automatic Prompt Optimization (RSIL)</Label>
                <p className="text-xs text-muted-foreground">Let the system analyze interactions and suggest prompt improvements</p>
              </div>
              <Switch id="rsil-toggle" checked={rsilEnabled} onCheckedChange={setRsilEnabled} />
            </div>

            {rsilEnabled && (
              <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="min-interactions">Min Interactions Before Optimize</Label>
                  <Input id="min-interactions" type="number" value={minInteractions} onChange={(e) => setMinInteractions(Number(e.target.value))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="opt-freq">Optimization Frequency</Label>
                  <Select value={optimizationFreq} onValueChange={setOptimizationFreq}>
                    <SelectTrigger id="opt-freq">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="max-updates">Max Updates Per Day</Label>
                  <Input id="max-updates" type="number" value={maxUpdates} onChange={(e) => setMaxUpdates(Number(e.target.value))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cooldown">Cooldown Hours</Label>
                  <Input id="cooldown" type="number" value={cooldownHours} onChange={(e) => setCooldownHours(Number(e.target.value))} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor="require-approval" className="text-sm font-medium">Require Developer Approval</Label>
                    <p className="text-xs text-muted-foreground">
                      If checked, all automated improvements will be sent to your inbox as Suggestions instead of auto-deploying.
                    </p>
                  </div>
                  <Switch id="require-approval" checked={requireApproval} onCheckedChange={setRequireApproval} />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  )
}
