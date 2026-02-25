"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Check, Download, ExternalLink } from "lucide-react"
import dynamic from "next/dynamic"

// Lazy-load Monaco Editor to reduce initial bundle size
const Editor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 rounded-md border bg-muted">
      <p className="text-sm text-muted-foreground">Loading editor...</p>
    </div>
  ),
})

type ParsedEndpoint = {
  method: string
  path: string
  description: string
}

const PLACEHOLDER_SCHEMA = `{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {
    "/example": {
      "get": {
        "summary": "Example endpoint",
        "description": "Returns example data"
      }
    }
  }
}`


interface ActionsTabProps {
  schemaString: string
  onUpdate: (schemaString: string) => void
}

export function ActionsTab({ schemaString, onUpdate }: ActionsTabProps) {
  const [importUrl, setImportUrl] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)
  const [endpoints, setEndpoints] = useState<ParsedEndpoint[]>([])
  const [isValid, setIsValid] = useState(false)

  // Validate schema when prop changes
  useEffect(() => {
    validateSchema(schemaString || "")
  }, [schemaString])

  const validateSchema = (value: string) => {
    if (!value.trim()) {
      setValidationError(null)
      setEndpoints([])
      setIsValid(false)
      return
    }

    try {
      const parsed = JSON.parse(value)
      if (!parsed.openapi && !parsed.swagger) {
        setValidationError("Missing 'openapi' or 'swagger' field. Must be a valid OpenAPI schema.")
        setEndpoints([])
        setIsValid(false)
        return
      }

      // Extract endpoints from paths
      const extractedEndpoints: ParsedEndpoint[] = []
      if (parsed.paths) {
        Object.entries(parsed.paths).forEach(([path, methods]: [string, any]) => {
          Object.entries(methods).forEach(([method, details]: [string, any]) => {
            if (["get", "post", "put", "patch", "delete"].includes(method)) {
              extractedEndpoints.push({
                method: method.toUpperCase(),
                path,
                description: details.summary || details.description || "No description",
              })
            }
          })
        })
      }

      setValidationError(null)
      setEndpoints(extractedEndpoints)
      setIsValid(true)
    } catch {
      setValidationError("Invalid JSON. Please check your schema syntax.")
      setEndpoints([])
      setIsValid(false)
    }
  }

  const handleEditorChange = (value: string | undefined) => {
    const v = value || ""
    onUpdate(v)
  }

  const handleImport = async () => {
    if (!importUrl.trim()) return
    try {
      const res = await fetch(importUrl)
      const text = await res.text()
      onUpdate(text)
    } catch {
      setValidationError("Failed to fetch schema from URL")
    }
  }

  const METHOD_COLORS: Record<string, string> = {
    GET: "text-green-600 bg-green-50",
    POST: "text-blue-600 bg-blue-50",
    PUT: "text-amber-600 bg-amber-50",
    PATCH: "text-orange-600 bg-orange-50",
    DELETE: "text-red-600 bg-red-50",
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="mb-1">
        <h3 className="text-sm font-medium text-foreground">Custom Actions</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Define OpenAPI schemas to give your agent custom API integrations
        </p>
      </div>

      {/* Import URL */}
      <div className="space-y-2">
        <Label>Import from URL</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://api.example.com/openapi.json"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
          />
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Download className="size-4 mr-1" />
            Fetch
          </Button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="space-y-2">
        <Label>OpenAPI Schema (JSON)</Label>
        <div className="rounded-md border overflow-hidden">
          <Editor
            height="300px"
            defaultLanguage="json"
            value={schemaString}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 2,
            }}
          />
        </div>
      </div>

      {/* Validation Status */}
      {validationError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{validationError}</p>
        </div>
      )}

      {isValid && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/50 bg-green-50 p-3">
          <Check className="size-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-700">Valid OpenAPI schema</p>
        </div>
      )}

      {/* Endpoint Preview */}
      {endpoints.length > 0 && (
        <div className="space-y-2">
          <Label>Discovered Endpoints</Label>
          <div className="flex flex-col gap-1.5">
            {endpoints.map((ep, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border p-2.5"
              >
                <span
                  className={`rounded px-2 py-0.5 text-xs font-mono font-semibold ${METHOD_COLORS[ep.method] || "text-foreground bg-muted"}`}
                >
                  {ep.method}
                </span>
                <span className="text-sm font-mono text-foreground">{ep.path}</span>
                <span className="text-xs text-muted-foreground ml-auto truncate max-w-[40%]">
                  {ep.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
