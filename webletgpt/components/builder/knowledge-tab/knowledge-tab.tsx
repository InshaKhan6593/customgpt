"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Trash2, FileText, Loader2, AlertCircle } from "lucide-react"

type KnowledgeFile = {
  id: string
  filename: string
  fileSize: number
  chunkCount: number
  status: "uploading" | "processing" | "done" | "error"
  errorMessage?: string
}

const ACCEPTED_TYPES = [".pdf", ".docx", ".txt", ".csv", ".md"]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function KnowledgeTab({ webletId }: { webletId: string }) {
  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Load existing files on mount
  useEffect(() => {
    async function loadFiles() {
      try {
        const res = await fetch(`/api/weblets/${webletId}/knowledge`)
        if (!res.ok) return
        const data = await res.json()
        const existing: KnowledgeFile[] = (Array.isArray(data) ? data : []).map((f: any) => ({
          id: f.id,
          filename: f.filename,
          fileSize: f.fileSize,
          chunkCount: f._count?.chunks || 0,
          status: "done" as const,
        }))
        setFiles(existing)
      } catch (err) {
        console.error("Failed to load knowledge files:", err)
      }
    }
    if (webletId) loadFiles()
  }, [webletId])

  const uploadFile = useCallback(
    async (file: globalThis.File) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase()
      if (!ACCEPTED_TYPES.includes(ext)) return
      if (file.size > MAX_FILE_SIZE) return

      const tempId = `temp_${Date.now()}`
      const newFile: KnowledgeFile = {
        id: tempId,
        filename: file.name,
        fileSize: file.size,
        chunkCount: 0,
        status: "uploading",
      }
      setFiles((prev) => [...prev, newFile])

      try {
        // Update status to processing
        setFiles((prev) =>
          prev.map((f) => (f.id === tempId ? { ...f, status: "processing" as const } : f))
        )

        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch(`/api/weblets/${webletId}/knowledge`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || "Upload failed")
        }

        const created = await res.json()

        // Replace temp entry with real data
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId
              ? {
                  id: created.id,
                  filename: created.filename,
                  fileSize: created.fileSize,
                  chunkCount: created.chunkCount || 0,
                  status: "done" as const,
                }
              : f
          )
        )
      } catch (error: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === tempId
              ? { ...f, status: "error" as const, errorMessage: error.message }
              : f
          )
        )
      }
    },
    [webletId]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      Array.from(e.dataTransfer.files).forEach(uploadFile)
    },
    [uploadFile]
  )

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach(uploadFile)
    }
  }

  const deleteFile = async (id: string) => {
    // Skip API call for temp/errored entries
    if (!id.startsWith("temp_")) {
      try {
        await fetch(`/api/weblets/${webletId}/knowledge/${id}`, { method: "DELETE" })
      } catch (err) {
        console.error("Failed to delete file:", err)
      }
    }
    setFiles((prev) => prev.filter((f) => f.id !== id))
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
                  {(file.status === "uploading" || file.status === "processing") && (
                    <span className="flex items-center gap-1 text-xs text-amber-600">
                      <Loader2 className="size-3 animate-spin" />
                      {file.status === "uploading" ? "Uploading..." : "Processing (extract → chunk → embed)..."}
                    </span>
                  )}
                  {file.status === "done" && (
                    <span className="text-xs text-green-600">✓ Ready</span>
                  )}
                  {file.status === "error" && (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="size-3" />
                      {file.errorMessage || "Processing failed"}
                    </span>
                  )}
                </div>
                {(file.status === "uploading" || file.status === "processing") && (
                  <Progress
                    value={file.status === "uploading" ? 25 : 60}
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
