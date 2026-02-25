"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CreditBar } from "@/components/billing/credit-bar";
import { PlanSelector } from "@/components/billing/plan-selector";
import { UsageTable } from "@/components/billing/usage-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import { CheckCircle2, XCircle, RefreshCw, Zap, TrendingUp } from "lucide-react";

interface BillingData {
  userPlan: any | null;
  devPlan: any | null;
}

function BillingBanner({ onRefresh }: { onRefresh: () => void }) {
  const params = useSearchParams();
  if (params.get("success"))
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-3 text-green-600 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Plan upgraded! If your plan hasn't updated yet, click refresh.
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onRefresh}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>
    );
  if (params.get("cancelled"))
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive text-sm">
        <XCircle className="w-4 h-4 shrink-0" />
        Checkout was cancelled. No charges were made.
      </div>
    );
  return null;
}

export default function BillingPage() {
  const [data, setData] = useState<BillingData>({ userPlan: null, devPlan: null });
  const [userRecords, setUserRecords] = useState<any[]>([]);
  const [devRecords, setDevRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, usageRes] = await Promise.all([
        fetch("/api/billing/plans"),
        fetch("/api/billing/usage"),
      ]);
      const planData = await planRes.json();
      const usageData = await usageRes.json();
      setData({ userPlan: planData.userPlan, devPlan: planData.devPlan });
      setUserRecords(usageData.userRecords ?? []);
      setDevRecords(usageData.devRecords ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // If redirected back from Stripe with ?success=true, re-fetch after a short
    // delay to give the webhook time to update the DB
    const isSuccess = new URLSearchParams(window.location.search).get("success");
    if (isSuccess) {
      const t = setTimeout(() => load(), 2500);
      return () => clearTimeout(t);
    }
  }, [load]);

  const { userPlan, devPlan } = data;

  const userResetDays = userPlan
    ? differenceInDays(new Date(userPlan.billingCycleEnd), new Date())
    : undefined;
  const devResetDays = devPlan
    ? differenceInDays(new Date(devPlan.billingCycleEnd), new Date())
    : undefined;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Billing & Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your credit usage, upgrade your plan, and review message-level costs.
        </p>
      </div>

      <Suspense fallback={null}>
        <BillingBanner onRefresh={load} />
      </Suspense>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="user-usage">My Usage</TabsTrigger>
          <TabsTrigger value="dev-usage">Developer Usage</TabsTrigger>
          <TabsTrigger value="upgrade">Upgrade Plan</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-36 rounded-xl" />
              <Skeleton className="h-36 rounded-xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User plan */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Your User Credits</CardTitle>
                    <CardDescription>Used when chatting with weblets</CardDescription>
                  </div>
                  <Badge variant="outline">{userPlan?.tier ?? "FREE_USER"}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CreditBar
                    used={userPlan?.creditsUsed ?? 0}
                    total={userPlan?.creditsIncluded ?? 100}
                    resetDaysRemaining={userResetDays}
                  />
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">
                        {userPlan?.workflowRunsUsed ?? 0}
                      </span>{" "}
                      / {userPlan?.workflowRunsIncluded ?? 2} workflow runs used
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Dev plan */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Developer Credits</CardTitle>
                    <CardDescription>Used when users chat with your weblets</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{devPlan?.tier ?? "STARTER"}</Badge>
                    {devPlan?.autoReloadEnabled && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <RefreshCw className="w-3 h-3" />
                        Auto-reload
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <CreditBar
                    used={devPlan?.creditsUsed ?? 0}
                    total={devPlan?.creditsIncluded ?? 200}
                    resetDaysRemaining={devResetDays}
                  />
                  {devPlan?.autoReloadEnabled && (
                    <p className="text-xs text-muted-foreground mt-2">
                      When credits hit 0, your card is charged $
                      {(devPlan.autoReloadAmount * Number(devPlan.overageRate)).toFixed(2)} for{" "}
                      {devPlan.autoReloadAmount.toLocaleString()} credits automatically.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── My Usage (as user) ── */}
        <TabsContent value="user-usage" className="mt-6 space-y-4">
          <div>
            <h2 className="font-semibold">Your Chat History</h2>
            <p className="text-sm text-muted-foreground">
              Every message you sent across all weblets, with credits consumed.
            </p>
          </div>
          {loading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : (
            <UsageTable records={userRecords} emptyText="No chats yet. Start chatting with a weblet to see usage here." />
          )}
        </TabsContent>

        {/* ── Developer Usage ── */}
        <TabsContent value="dev-usage" className="mt-6 space-y-4">
          <div>
            <h2 className="font-semibold">Usage on Your Weblets</h2>
            <p className="text-sm text-muted-foreground">
              Every request handled by weblets you built, with platform cost breakdown.
            </p>
          </div>
          {loading ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : devRecords.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No usage yet. Users haven't chatted with your weblets, or you don't have any weblets
              yet.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-1 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Total Requests</CardTitle>
                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">{devRecords.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Credits Consumed</CardTitle>
                    <Zap className="w-3.5 h-3.5 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">
                      {devRecords.reduce((s, r) => s + r.creditsCharged, 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Est. Cost</CardTitle>
                    <span className="text-xs text-muted-foreground">USD</span>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">
                      ${devRecords.reduce((s, r) => s + Number(r.estimatedCost), 0).toFixed(4)}
                    </div>
                  </CardContent>
                </Card>
              </div>
              <UsageTable records={devRecords} />
            </div>
          )}
        </TabsContent>

        {/* ── Upgrade & Settings ── */}
        <TabsContent value="upgrade" className="mt-6 space-y-8">
          <div>
            <h2 className="font-semibold">User Plans</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Credits for chatting with weblets as a user.
            </p>
            <PlanSelector type="user" currentTier={userPlan?.tier} />
          </div>
          <div>
            <h2 className="font-semibold">Developer Plans</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Credits for serving your weblets to users.
            </p>
            <PlanSelector type="developer" currentTier={devPlan?.tier} />
          </div>
          
          {/* Developer Settings */}
          {devPlan && (
            <div className="pt-8 border-t">
              <h2 className="font-semibold text-lg">Developer Settings</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Manage your weblet hosting configuration and billing preferences.
              </p>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Auto-Reload Configuration</CardTitle>
                  <CardDescription>
                    Automatically purchase additional credits when your balance hits 0 to prevent your Weblets from going offline.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium text-sm">Enable Auto-Reload</div>
                      <div className="text-xs text-muted-foreground">Keep your weblets online automatically.</div>
                    </div>
                    {/* Dummy switch state for now as requested by instructions */}
                    <div className="flex items-center space-x-2">
                       <span className="text-sm font-medium">{devPlan.autoReloadEnabled ? "Enabled" : "Disabled"}</span>
                       <Button variant="outline" size="sm">Toggle</Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="font-medium text-sm">Reload Amount</div>
                    <div className="flex gap-4">
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        defaultValue={devPlan.autoReloadAmount.toString()}
                      >
                        <option value="2000">Reload $10 (2,000 credits) at a time</option>
                        <option value="5000">Reload $25 (5,000 credits) at a time</option>
                        <option value="10000">Reload $50 (10,000 credits) at a time</option>
                      </select>
                      <Button>Save</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
