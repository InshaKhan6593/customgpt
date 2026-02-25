"use client";

import { AlertCircle } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

interface DeveloperQuotaAlertProps {
  show: boolean;
  className?: string;
}

export function DeveloperQuotaAlert({ show, className = "" }: DeveloperQuotaAlertProps) {
  if (!show) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Weblet Unavailable</AlertTitle>
      <AlertDescription>
        This Weblet is temporarily unavailable (creator quota exceeded). You can review your past
        conversation history, but new messages cannot be sent right now.
      </AlertDescription>
    </Alert>
  );
}
