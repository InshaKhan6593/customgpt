"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "user_credits_exceeded" | "developer_credits_exhausted" | string;
}

const MESSAGES = {
  user_credits_exceeded: {
    title: "You've run out of credits",
    description:
      "You've used all your free credits this month. Upgrade to Plus for 1,000 credits/month at just $9.99/month.",
    cta: "Upgrade to Plus →",
  },
  developer_credits_exhausted: {
    title: "This weblet is temporarily unavailable",
    description:
      "The creator of this weblet has exceeded their monthly quota. Please try again later or try a different weblet.",
    cta: null,
  },
  default: {
    title: "Upgrade your plan",
    description:
      "You need more credits to continue. Upgrade your plan to keep chatting.",
    cta: "View Plans →",
  },
};

export function UpgradeModal({ open, onClose, reason = "default" }: UpgradeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const msg = MESSAGES[reason as keyof typeof MESSAGES] ?? MESSAGES.default;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "PLUS", type: "user" }),
      });
      const data = await res.json();
      if (data.url) {
        router.push(data.url);
      }
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-full bg-primary/10">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle>{msg.title}</DialogTitle>
          </div>
          <DialogDescription>{msg.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Maybe Later
          </Button>
          {msg.cta && (
            <Button onClick={handleUpgrade} disabled={loading} className="w-full sm:w-auto">
              {loading ? "Redirecting…" : msg.cta}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
