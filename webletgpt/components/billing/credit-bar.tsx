"use client";

interface CreditBarProps {
  used: number;
  total: number;
  resetDaysRemaining?: number;
}

export function CreditBar({ used, total, resetDaysRemaining }: CreditBarProps) {
  const isUnlimited = total === -1;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / total) * 100));
  const color = pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-foreground">
          {used.toLocaleString()} {isUnlimited ? "" : `/ ${total.toLocaleString()}`} credits used
        </span>
        {!isUnlimited && (
          <span className="text-muted-foreground">{pct}%</span>
        )}
      </div>
      {!isUnlimited && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {resetDaysRemaining !== undefined && (
        <p className="text-xs text-muted-foreground">
          Resets in {resetDaysRemaining} day{resetDaysRemaining !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
