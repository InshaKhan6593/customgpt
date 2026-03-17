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
import { UPGRADE_MESSAGES } from "@/lib/billing/pricing";
import { Zap } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "user_credits_exceeded" | "developer_credits_exhausted" | string;
}

export function UpgradeModal({ open, onClose, reason = "default" }: UpgradeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const msg = UPGRADE_MESSAGES[reason as keyof typeof UPGRADE_MESSAGES] ?? UPGRADE_MESSAGES.default;

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
