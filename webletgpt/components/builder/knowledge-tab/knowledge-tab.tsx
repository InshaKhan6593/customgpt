"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, File, Trash2, FileText, Loader2 } from "lucide-react"

type KnowledgeFile = {
  id: string
  filename: string
  fileSize: number
  chunkCount: number
  status: "uploading" | "extracting" | "chunking" | "embedding" | "done" | "error"
}

const ACCEPTED_TYPES = [".pdf", ".docx", ".txt", ".csv", ".md"]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STATUS_LABELS: Record<KnowledgeFile["status"], string> = {
  uploading: "Uploading...",
  extracting: "Extracting text...",
  chunking: "Chunking...",
  embedding: "Generating embeddings...",
  done: "Done",
  error: "Error",
}

export function KnowledgeTab({ webletId }: { webletId: string }) {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const simulateUpload = useCallback(
    (file: globalThis.File) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase()
      if (!ACCEPTED_TYPES.includes(ext)) {
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        return
      }

      const newFile: KnowledgeFile = {
        id: Date.now().toString(),
        filename: file.name,
        fileSize: file.size,
        chunkCount: 0,
        status: "uploading",
      }
      setFiles((prev) => [...prev, newFile])

      // Simulate the processing pipeline stages
      const stages: KnowledgeFile["status"][] = [
        "extracting",
        "chunking",
        "embedding",
        "done",
      ]
      stages.forEach((stage, i) => {
        setTimeout(() => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === newFile.id
                ? {
                    ...f,
                    status: stage,
                    chunkCount: stage === "done" ? Math.floor(Math.random() * 80) + 20 : 0,
                  }
                : f
            )
          )
        }, (i + 1) * 1200)
      })
    },
    []
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      Array.from(e.dataTransfer.files).forEach(simulateUpload)
    },
    [simulateUpload]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(simulateUpload)
    }
  }

  const deleteFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    // TODO: DELETE /api/weblets/[id]/knowledge/[fileId]
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1">
        <h3 className="text-sm font-medium text-foreground">Knowledge Base</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Upload documents to give your agent specialized knowledge
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}`}
      >
        <Upload className="size-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            Drag & drop files here
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOCX, TXT, CSV, MD — Max 20MB each
          </p>
        </div>
        <label>
          <input
            type="file"
            className="hidden"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            onChange={handleFileInput}
          />
          <Button variant="outline" size="sm" asChild>
            <span>Browse Files</span>
          </Button>
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <FileText className="size-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.filename}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)}
                  </span>
                  {file.status === "done" && (
                    <span className="text-xs text-muted-foreground">
                      • {file.chunkCount} chunks
                    </span>
                  )}
                  {file.status !== "done" && file.status !== "error" && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Loader2 className="size-3 animate-spin" />
                      {STATUS_LABELS[file.status]}
                    </span>
                  )}
                  {file.status === "done" && (
                    <span className="text-xs text-green-600">
                      ✓ {STATUS_LABELS[file.status]}
                    </span>
                  )}
                </div>
                {file.status !== "done" && file.status !== "error" && (
                  <Progress
                    value={
                      file.status === "uploading"
                        ? 25
                        : file.status === "extracting"
                        ? 50
                        : file.status === "chunking"
                        ? 75
                        : 90
                    }
                    className="mt-2 h-1"
                  />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteFile(file.id)}
                className="shrink-0"
              >
                <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
