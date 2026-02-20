"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface FeedbackDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (feedback: string) => void
}

export function FeedbackDialog({ isOpen, onClose, onSubmit }: FeedbackDialogProps) {
  const [feedback, setFeedback] = useState("")

  const handleSubmit = () => {
    if (!feedback.trim()) return
    onSubmit(feedback.trim())
    setFeedback("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provide Feedback</DialogTitle>
          <DialogDescription>
            Help us improve this Weblet by telling us what went wrong.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="The AI gave me outdated information about React 18..."
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!feedback.trim()}>Submit Feedback</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
