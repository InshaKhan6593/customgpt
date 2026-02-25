"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OutOfCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Optional callback if they decline
  onDecline?: () => void;
}

export function OutOfCreditsModal({
  open,
  onOpenChange,
  onDecline,
}: OutOfCreditsModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would call an API route to generate a Stripe Checkout session
      // For now, we simulate a network delay then route to a hypothetical checkout page
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push("/billing/upgrade");
    } catch (error) {
      console.error("Failed to redirect to checkout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    if (onDecline) {
      onDecline();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            You&apos;ve used all your free credits this month.
          </AlertDialogTitle>
          <AlertDialogDescription>
            Upgrade to the Plus plan for 1,000 credits/month at just $9.99/mo to
            continue chatting with advanced Weblets.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Maybe Later
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgrade} disabled={isLoading}>
            {isLoading ? "Redirecting..." : "Upgrade to Plus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
