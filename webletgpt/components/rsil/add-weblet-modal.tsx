"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Weblet {
  id: string
  name: string
  slug: string
  rsilEnabled: boolean
  interactionCount: number
}

interface AddWebletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: () => void
}

export function AddWebletModal({
  open,
  onOpenChange,
  onAdd,
}: AddWebletModalProps) {
  const [candidates, setCandidates] = useState<Weblet[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [enablingId, setEnablingId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    async function fetchCandidates() {
      setLoading(true)
      try {
        const res = await fetch("/api/weblets/rsil-candidates")
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        setCandidates(data.weblets || [])
      } catch (err) {
        toast.error("Failed to load weblets")
        if (err instanceof Error) {
          console.error("Candidate fetch error:", err.message)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchCandidates()
  }, [open])

  async function handleEnableRSIL(webletId: string) {
    if (enablingId) return

    setEnablingId(webletId)
    try {
      const res = await fetch("/api/rsil/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webletId, rsilEnabled: true }),
      })

      if (!res.ok) throw new Error("Failed to enable")

      toast.success("RSIL enabled")
      onAdd()
      onOpenChange(false)
    } catch (err) {
      toast.error("Failed to enable RSIL")
      if (err instanceof Error) {
        console.error("Enable RSIL error:", err.message)
      }
    } finally {
      setEnablingId(null)
    }
  }

  const filteredCandidates = candidates
    .filter((w) => !w.rsilEnabled)
    .filter((w) =>
      search.trim() === "" ? true : w.name.toLowerCase().includes(search.toLowerCase())
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Weblet to RSIL</DialogTitle>
          <DialogDescription>
            Select a weblet to enable RSIL tracking and optimization.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search weblets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Loading weblets...
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-muted-foreground text-sm">
                {search.trim() === ""
                  ? "All weblets already have RSIL enabled"
                  : "No matching weblets found"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCandidates.map((weblet) => (
                <button
                  key={weblet.id}
                  onClick={() => handleEnableRSIL(weblet.id)}
                  disabled={enablingId !== null}
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{weblet.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {weblet.interactionCount} interaction{weblet.interactionCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {enablingId === weblet.id && (
                    <span className="text-muted-foreground text-sm">Enabling...</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
