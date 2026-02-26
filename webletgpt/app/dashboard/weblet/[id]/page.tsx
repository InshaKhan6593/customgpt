"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OverviewTrendChart } from "@/components/dashboard/charts/overview-trend-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Activity, Database, DollarSign, TextSearch, Settings, Star, ExternalLink } from "lucide-react";
import Link from "next/link";
import { RsilEmptyState } from "@/components/dashboard/rsil-empty-state";
import { ObservabilityEmptyState } from "@/components/dashboard/observability-empty-state";

export default function WebletAnalyticsPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch(`/api/dashboard/weblet/${id}`);
        if (!res.ok) throw new Error("Failed to load");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load weblet data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
         <div className="flex items-center gap-4">
           <Skeleton className="w-10 h-10 rounded-md" />
           <div className="space-y-2">
             <Skeleton className="w-48 h-8 rounded-md" />
             <Skeleton className="w-32 h-4 rounded-md" />
           </div>
         </div>
         <Skeleton className="w-full h-12 rounded-xl" />
         <div className="grid gap-4 sm:grid-cols-3">
           {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
         </div>
         <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (!data?.weblet) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center gap-4">
        <h2 className="text-2xl font-bold">Weblet Not Found</h2>
        <p className="text-muted-foreground">This weblet may have been deleted or you don't have access.</p>
        <Link href="/dashboard"><Button>Back to Dashboard</Button></Link>
      </div>
    );
  }

  const { weblet, stats, dailyTrend, left } = data;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
         <div className="flex items-center gap-4">
           <Link href="/dashboard">
             <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
               <ArrowLeft className="h-4 w-4" />
             </Button>
           </Link>
           <div>
             <div className="flex items-center gap-3">
               <h1 className="text-2xl font-bold tracking-tight">{weblet.name}</h1>
               <Badge variant={weblet.isPublic ? "default" : "secondary"}>
                 {weblet.isPublic ? "Published" : "Draft"}
               </Badge>
             </div>
             <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
               <span className="flex items-center gap-1">
                 <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                 {weblet.averageRating} ({weblet.ratingsCount})
               </span>
               {weblet.category && <span>• {weblet.category}</span>}
               <span>• {weblet.pricingModel === "FREE" ? "Free" : `$${weblet.priceAmount}`}</span>
             </div>
           </div>
         </div>
         <div className="flex items-center gap-2">
           <Link href={`/t/${weblet.id}`} target="_blank">
             <Button variant="outline" size="sm" className="gap-2">
               <ExternalLink className="h-4 w-4" /> View Chat
             </Button>
           </Link>
           <Link href={`/builder?id=${weblet.id}`}>
             <Button size="sm" className="gap-2">
               <Edit className="h-4 w-4" /> Edit Weblet
             </Button>
           </Link>
         </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto w-full justify-start gap-1 p-1 bg-muted/50">
          <TabsTrigger value="overview" className="gap-2"><Activity className="h-4 w-4" /> Overview</TabsTrigger>
          <TabsTrigger value="rsil" className="gap-2"><Database className="h-4 w-4" /> RSIL Inbox</TabsTrigger>
          <TabsTrigger value="monetization" className="gap-2"><DollarSign className="h-4 w-4" /> Monetization</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><TextSearch className="h-4 w-4" /> Execution Logs</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><Settings className="h-4 w-4" /> Dev Billing</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Chats (30d)</CardTitle>
                <Activity className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalChats.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Subscribers</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeSubscribers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">If subscription enabled</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (30d)</CardTitle>
                <DollarSign className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-1">Net revenue earned</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Usage & Revenue</CardTitle>
              <CardDescription>Daily performance for this specific weblet.</CardDescription>
            </CardHeader>
            <CardContent>
               <OverviewTrendChart data={dailyTrend} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* RSIL Tab (Mocked for Segment 14) */}
        <TabsContent value="rsil" className="space-y-6">
           <RsilEmptyState />
        </TabsContent>

        {/* Monetization Tab */}
        <TabsContent value="monetization" className="space-y-6">
           <Card>
             <CardHeader>
               <CardTitle>Weblet Pricing Strategy</CardTitle>
               <CardDescription>Configure how users pay for this weblet directly in the Builder.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4 text-sm">
               <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Current Model</span>
                  <Badge variant={weblet.pricingModel === "FREE" ? "secondary" : "default"}>{weblet.pricingModel}</Badge>
               </div>
               {weblet.pricingModel !== "FREE" && (
                 <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-muted-foreground">Price Amount</span>
                    <span className="font-medium">${weblet.priceAmount}</span>
                 </div>
               )}
               <p className="text-muted-foreground pt-4">
                 Changes to pricing must be made via the Weblet Builder interface to ensure users are properly notified of model shifts.
               </p>
               <Link href={`/builder?id=${weblet.id}`}>
                 <Button variant="outline" className="mt-2">Go to Builder</Button>
               </Link>
             </CardContent>
           </Card>
        </TabsContent>

        {/* Execution Logs Tab (Mocked for Segment 15) */}
        <TabsContent value="logs" className="space-y-6">
           <ObservabilityEmptyState />
        </TabsContent>
        
        {/* Developer Billing Tab (Points to global billing) */}
        <TabsContent value="billing" className="space-y-6">
           <Card>
             <CardHeader>
               <CardTitle>Developer Billing & Quotas</CardTitle>
               <CardDescription>Manage your credits and API spend for this weblet.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <p className="text-sm text-foreground">
                 Developer billing (auto-reload limits, API key usage) is now managed globally across your entire account, rather than on a per-weblet basis.
               </p>
               <div className="bg-muted p-4 rounded-lg text-sm border">
                 <h4 className="font-semibold mb-1">Global Limit Active</h4>
                 <p className="text-muted-foreground mb-3">Your global auto-reload setting applies to all weblets, preventing runaway API costs.</p>
                 <Link href="/dashboard/billing">
                    <Button variant="secondary">Manage Global Billing</Button>
                 </Link>
               </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
