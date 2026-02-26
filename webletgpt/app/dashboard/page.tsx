"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, RefreshCw, BarChart3, Users, DollarSign, Star, MoreVertical, LayoutDashboard } from "lucide-react";
import { OverviewTrendChart } from "@/components/dashboard/charts/overview-trend-chart";
import { CategoryBreakdownChart } from "@/components/dashboard/charts/category-breakdown-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DashboardOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/dashboard/overview");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
           <Skeleton className="w-48 h-8 rounded-md mb-2" />
           <Skeleton className="w-64 h-4 rounded-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  // Fallback if no weblets
  if (!data || data.topWeblets?.length === 0) {
    return (
      <div className="flex flex-col gap-8 max-w-5xl mx-auto items-center py-24 text-center">
        <div className="rounded-full bg-muted p-6">
          <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to your Dashboard</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            You don't have any weblets yet. Build your first AI agent to see analytics here.
          </p>
        </div>
        <Link href="/builder">
          <Button size="lg" className="gap-2">
            <Plus className="h-4 w-4" /> Create a Weblet
          </Button>
        </Link>
      </div>
    );
  }

  const { overview, dailyTrend, categoryBreakdown, topWeblets } = data;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
         <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">Aggregate performance across your portfolio.</p>
         </div>
         <div className="flex items-center gap-2">
            <Link href="/builder">
               <Button size="sm" variant="outline" className="gap-2"><Plus className="w-4 h-4" /> New Weblet</Button>
            </Link>
         </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Chats</CardTitle>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overview.totalChats.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all weblets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
            <Star className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">{overview.averageRating}</span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Weighted average</p>
          </CardContent>
        </Card>
        <Card className="opacity-60 relative group">
          <div className="absolute inset-0 z-10 hidden group-hover:flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
            <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted">Available when monetization is enabled</span>
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscribers</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overview.activeSubscribers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Paying users</p>
          </CardContent>
        </Card>
        <Card className="opacity-60 relative group">
          <div className="absolute inset-0 z-10 hidden group-hover:flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
             <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted">Available when monetization is enabled</span>
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">${overview.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">After platform fees</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Chats & Revenue</CardTitle>
            <CardDescription>Daily comparison over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
             <OverviewTrendChart data={dailyTrend} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Portfolio Breakdown</CardTitle>
            <CardDescription>Category distribution of your weblets</CardDescription>
          </CardHeader>
          <CardContent>
             <CategoryBreakdownChart data={categoryBreakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Top Performing Weblets</CardTitle>
            <CardDescription>Your portfolio ranked by 30-day chat volume.</CardDescription>
          </div>
          <Link href="/dashboard/weblets">
            <Button variant="ghost" size="sm">View All</Button>
          </Link>
        </CardHeader>
        <div className="px-6 pb-6 pt-0">
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
               <thead className="bg-muted/50 text-muted-foreground">
                 <tr>
                   <th className="font-medium text-left px-4 py-3 border-b">Weblet Name</th>
                   <th className="font-medium text-left px-4 py-3 border-b">Category</th>
                   <th className="font-medium text-left px-4 py-3 border-b">Status</th>
                   <th className="font-medium text-right px-4 py-3 border-b">Avg Rating</th>
                   <th className="font-medium text-right px-4 py-3 border-b">Chats (30d)</th>
                   <th className="font-medium text-right px-4 py-3 border-b opacity-50" title="Available later">Revenue</th>
                   <th className="w-[50px] border-b"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border">
                 {topWeblets.map((w: any) => (
                   <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                     <td className="px-4 py-3 font-medium">
                       <Link href={`/dashboard/weblet/${w.id}`} className="hover:underline">{w.name}</Link>
                     </td>
                     <td className="px-4 py-3 text-muted-foreground">
                       {w.category ? <Badge variant="secondary" className="font-normal">{w.category}</Badge> : "—"}
                     </td>
                     <td className="px-4 py-3">
                        <Badge variant={w.status === "Active" ? "default" : "outline"} className="font-normal text-xs">{w.status}</Badge>
                     </td>
                     <td className="px-4 py-3 text-right">
                       <span className="flex items-center justify-end gap-1">
                          {w.rating} <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                       </span>
                     </td>
                     <td className="px-4 py-3 text-right tabular-nums">{w.chats.toLocaleString()}</td>
                     <td className="px-4 py-3 text-right text-muted-foreground opacity-50">—</td>
                     <td className="px-4 py-3">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end">
                           <Link href={`/dashboard/weblet/${w.id}`}>
                              <DropdownMenuItem>View Analytics</DropdownMenuItem>
                           </Link>
                           <Link href={`/builder?id=${w.id}`}>
                              <DropdownMenuItem>Edit in Builder</DropdownMenuItem>
                           </Link>
                         </DropdownMenuContent>
                       </DropdownMenu>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </div>
      </Card>
      
    </div>
  );
}
