"use client"

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

interface RatingDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  feedbackText: string
  onFeedbackChange: (text: string) => void
  onSubmit: () => void
  isSubmitting: boolean
}

export function RatingDialog({
  isOpen,
  onOpenChange,
  feedbackText,
  onFeedbackChange,
  onSubmit,
  isSubmitting
}: RatingDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provide Feedback</DialogTitle>
          <DialogDescription>
            Why was this response unhelpful? Your feedback improves the weblet's RLHF model.
          </DialogDescription>
        </DialogHeader>
        <Textarea 
          placeholder="Tell us what went wrong..." 
          value={feedbackText}
          onChange={(e) => onFeedbackChange(e.target.value)}
          className="min-h-[100px]"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!feedbackText.trim() || isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
