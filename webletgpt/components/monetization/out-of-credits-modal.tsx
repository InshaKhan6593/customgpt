"use client";

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
  onDecline?: () => void;
}

export function OutOfCreditsModal({
  open,
  onOpenChange,
  onDecline,
}: OutOfCreditsModalProps) {
  const handleUpgrade = () => {
    onOpenChange(false);
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
            You&apos;ve reached your usage limit
          </AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ve used all your included runs and credits for this billing
            cycle. Upgrade your plan to get more workflow runs, chat credits, and
            unlock additional features.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            Maybe Later
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgrade}>
            Upgrade Plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
