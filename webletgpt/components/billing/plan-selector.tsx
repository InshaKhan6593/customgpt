"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles } from "lucide-react";
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
}

export function PlanSelector({ type, currentTier }: PlanSelectorProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const plans = type === "user" ? USER_PLANS : DEV_PLANS;

  const handleSelect = async (tier: string) => {
    if (tier === currentTier) return;
    setLoading(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, type }),
      });
      const data = await res.json();
      if (data.url) router.push(data.url);
      else if (data.error) console.error(data.error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {plans.map((plan, i) => {
        const isCurrent = plan.tier === currentTier;
        const isPopular = plan.popular;
        const isLoading = loading === plan.tier;

        return (
          <div
            key={plan.tier}
            className={cn(
              "relative flex flex-col p-4 gap-4 border border-border rounded-lg",
              // dividers between columns — no longer needed, using gap instead
              "bg-card",
              // current plan — subtle ring inside, no color conflict
              isCurrent && !isPopular && "ring-1 ring-inset ring-primary/40"
            )}
          >
            {/* "Most Popular" pill */}
            {isPopular && (
              <div className="absolute -top-px left-1/2 -translate-x-1/2">
                <div className="flex items-center gap-1 rounded-b-md bg-amber-500 border border-amber-400 px-3 py-0.5 text-xs font-semibold tracking-wide uppercase text-black">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </div>
              </div>
            )}

            {/* Current plan indicator */}
            {isCurrent && (
              <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm bg-primary/10 text-primary">
                Active
              </div>
            )}

            {/* Plan name & price */}
            <div className="pt-2">
              <p className={cn(
                "text-xs font-semibold uppercase tracking-widest mb-2",
                "text-muted-foreground"
              )}>
                {plan.name}
              </p>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-foreground">
                  {plan.price}
                </span>
                <span className="mb-1.5 text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>
              <p className="text-sm mt-1 text-muted-foreground">
                {plan.credits}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-border" />

            {/* Features */}
            <ul className="flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <div className="mt-0.5 shrink-0 rounded-full p-0.5 bg-primary/10">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-foreground">
                    {f}
                  </span>
                </li>
              ))}
            </ul>

            {/* CTA button */}
            <Button
              onClick={() => handleSelect(plan.tier)}
              disabled={isCurrent || isLoading}
              size="sm"
              className={cn(
                "w-full rounded-md font-semibold transition-all",
                isCurrent
                  ? "bg-muted text-muted-foreground cursor-default hover:bg-muted"
                  : isPopular
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border bg-transparent text-foreground hover:bg-accent"
              )}
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Redirecting…</>
              ) : isCurrent ? (
                "Current Plan"
              ) : plan.price === "$0" ? (
                "Downgrade"
              ) : (
                `Upgrade to ${plan.name}`
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
