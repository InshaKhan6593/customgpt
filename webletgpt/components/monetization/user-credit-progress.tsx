"use client";

import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserCreditProgressBarProps {
  usedCredits: number;
  totalCredits: number;
  daysUntilReset: number;
  className?: string;
  // Optional detailed breakdown for future use
  todayUsage?: number;
  weekUsage?: number;
}

export function UserCreditProgressBar({
  usedCredits,
  totalCredits,
  daysUntilReset,
  className = "",
  todayUsage,
  weekUsage,
}: UserCreditProgressBarProps) {
  // If unlimited credits (-1), we don't show a progress bar
  if (totalCredits === -1) {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        Unlimited Credits
      </div>
    );
  }

  const percentage = Math.min(
    Math.round((usedCredits / totalCredits) * 100),
    100
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className={`flex flex-col gap-1.5 w-full max-w-48 ${className}`}>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Credits</span>
              <span className="font-medium">
                {usedCredits.toLocaleString()} / {totalCredits.toLocaleString()} used
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="p-3 text-sm">
          <div className="space-y-4">
            <p className="font-medium">Resets in {daysUntilReset} days</p>
            {(todayUsage !== undefined || weekUsage !== undefined) && (
              <div className="space-y-1 text-muted-foreground text-xs">
                {todayUsage !== undefined && (
                  <div className="flex justify-between gap-4">
                    <span>Today:</span>
                    <span className="font-medium text-foreground">{todayUsage.toLocaleString()} credits</span>
                  </div>
                )}
                {weekUsage !== undefined && (
                  <div className="flex justify-between gap-4">
                    <span>This week:</span>
                    <span className="font-medium text-foreground">{weekUsage.toLocaleString()} credits</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span>This month:</span>
                  <span className="font-medium text-foreground">{usedCredits.toLocaleString()} credits</span>
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
