"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanType = "user" | "developer";

const USER_PLANS = [
  {
    tier: "FREE_USER",
    name: "Free",
    price: "$0",
    period: "/mo",
    credits: "100 credits / month",
    features: ["100 credits/month", "2 workflow runs/mo", "All free weblets"],
    popular: false,
  },
  {
    tier: "PLUS",
    name: "Plus",
    price: "$9.99",
    period: "/mo",
    credits: "1,000 credits / month",
    features: ["1,000 credits/month", "20 workflow runs/mo", "Multi-agent (5 agents)", "Priority support"],
    popular: true,
  },
  {
    tier: "POWER",
    name: "Power",
    price: "$19.99",
    period: "/mo",
    credits: "Unlimited credits",
    features: ["Unlimited credits", "Unlimited workflows", "Unlimited multi-agent", "Priority support"],
    popular: false,
  },
];

const DEV_PLANS = [
  {
    tier: "STARTER",
    name: "Starter",
    price: "$0",
    period: "/mo",
    credits: "200 credits / month",
    features: ["1 weblet", "200 credits/month", "No RSIL", "No composability"],
    popular: false,
  },
  {
    tier: "PRO",
    name: "Pro",
    price: "$29",
    period: "/mo",
    credits: "10,000 credits / month",
    features: ["5 weblets", "10,000 credits/month", "RSIL enabled", "Composability enabled"],
    popular: true,
  },
  {
    tier: "BUSINESS",
    name: "Business",
    price: "$99",
    period: "/mo",
    credits: "50,000 credits / month",
    features: ["Unlimited weblets", "50,000 credits/month", "RSIL + Composability + MCP", "Auto-reload overage"],
    popular: false,
  },
];

interface PlanSelectorProps {
  type: PlanType;
  currentTier?: string;
  onSuccess?: () => void; // called after an immediate upgrade so parent can re-fetch
}

const TIER_ORDER: Record<string, number> = {
  FREE_USER: 0, PLUS: 1, POWER: 2,
  STARTER: 0,  PRO: 1,   BUSINESS: 2,
};

export function PlanSelector({ type, currentTier, onSuccess }: PlanSelectorProps) {
  const router  = useRouter();
  const [loading,          setLoading]          = useState<string | null>(null);
  const [downgradeInfo,    setDowngradeInfo]     = useState<{ endsAt: string } | null>(null);
  const plans = type === "user" ? USER_PLANS : DEV_PLANS;

  const handleSelect = async (tier: string) => {
    if (tier === currentTier) return;
    setLoading(tier);
    setDowngradeInfo(null);

    try {
      const res  = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, type }),
      });
      const data = await res.json();

      if (data.error) {
        console.error("Plan change error:", data.error);
        return;
      }

      if (data.url) {
        // First-time subscriber — redirect to Stripe Checkout
        router.push(data.url);
        return;
      }

      if (data.upgraded) {
        // Immediate plan swap done — re-fetch without a page reload
        onSuccess?.();
        return;
      }

      if (data.downgraded) {
        // Scheduled to downgrade at period end — show info, re-fetch
        const date = new Date(data.endsAt).toLocaleDateString("en-US", {
          month: "long", day: "numeric", year: "numeric",
        });
        setDowngradeInfo({ endsAt: date });
        onSuccess?.();
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {downgradeInfo && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-amber-600 text-sm">
          <CalendarClock className="w-4 h-4 shrink-0" />
          Your plan will downgrade to the free tier on <strong>&nbsp;{downgradeInfo.endsAt}</strong>.
          You keep full access until then.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {plans.map((plan) => {
          const isCurrent = plan.tier === currentTier;
          const isPopular = plan.popular;
          const isLoading = loading === plan.tier;

          return (
            <div
              key={plan.tier}
              className={cn(
                "relative flex flex-col p-4 gap-4 border border-border rounded-lg bg-card",
                isCurrent && !isPopular && "ring-1 ring-inset ring-primary/40"
              )}
            >
              {isPopular && (
                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 rounded-b-md bg-amber-500 border border-amber-400 px-3 py-0.5 text-xs font-semibold tracking-wide uppercase text-black">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}

              {isCurrent && (
                <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-primary/10 text-primary">
                  Active
                </div>
              )}

              <div className="pt-2">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2 text-muted-foreground">
                  {plan.name}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-extrabold tracking-tight text-foreground">
                    {plan.price}
                  </span>
                  <span className="mb-1.5 text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm mt-1 text-muted-foreground">{plan.credits}</p>
              </div>

              <div className="h-px w-full bg-border" />

              <ul className="flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <div className="mt-0.5 shrink-0 rounded-full p-0.5 bg-primary/10">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelect(plan.tier)}
                disabled={isCurrent || !!loading}
                size="sm"
                className={cn(
                  "w-full rounded-md font-semibold transition-all",
                  isCurrent
                    ? "bg-muted text-muted-foreground cursor-default hover:bg-muted"
                    : "border border-border bg-transparent text-foreground hover:bg-accent"
                )}
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processing…</>
                ) : isCurrent ? (
                  "Current Plan"
                ) : currentTier && TIER_ORDER[plan.tier] < TIER_ORDER[currentTier] ? (
                  `Downgrade to ${plan.name}`
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
