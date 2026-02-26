"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, MessageSquare, X } from "lucide-react";

interface HitlApprovalCardProps {
  stepNumber: number;
  onRespond: (action: "approve" | "reject", feedback?: string) => void;
}

export function HitlApprovalCard({ stepNumber, onRespond }: HitlApprovalCardProps) {
  const [feedback, setFeedback] = useState("");

  const handleRespond = (action: "approve" | "reject") => {
    onRespond(action, feedback || undefined);
    setFeedback("");
  };

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 gap-1.5"
          >
            <AlertCircle className="w-3 h-3" />
            Approval Required
          </Badge>
          <span className="text-xs text-muted-foreground">
            Step {stepNumber} is paused — review the output above before continuing.
          </span>
        </div>

        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/50" />
            <Textarea
              placeholder="Add feedback or instructions (optional)..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="pl-9 min-h-10 resize-none text-sm bg-background/60 focus-visible:bg-background"
              rows={2}
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleRespond("reject")}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Reject
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-b from-zinc-800 to-zinc-950 hover:from-zinc-700 hover:to-zinc-900 text-zinc-50 border border-zinc-700/50 shadow-sm transition-all duration-200"
              onClick={() => handleRespond("approve")}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
