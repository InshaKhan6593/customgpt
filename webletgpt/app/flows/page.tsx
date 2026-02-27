"use client";

import { useEffect, useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Play, Pencil, Trash2, Workflow, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function FlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlows = async () => {
    try {
      const res = await fetch("/api/flows");
      const data = await res.json();
      if (res.ok) {
        setFlows(data.data);
      } else {
        toast.error(`Error fetching flows: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load: Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, []);

  const createNewFlow = async () => {
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Untitled Flow",
          description: "My new automated workflow",
          mode: "SEQUENTIAL",
          steps: [],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/flows/builder/${data.id}`);
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Create Flow Error:", error);
      toast.error("Could not create flow. Please check the console.");
    }
  };

  const deleteFlow = async (id: string) => {
    if (!confirm("Are you sure you want to delete this flow?")) return;
    try {
      const res = await fetch(`/api/flows/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Flow removed successfully.");
        setFlows(flows.filter((f) => f.id !== id));
      } else {
        const data = await res.json();
        toast.error(`Error: ${data.error}`);
      }
    } catch (e) {
      toast.error("Failed to delete flow");
    }
  };

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <NavHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My AI Workflows</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Chain AI agents together to automate multi-step tasks.
            </p>
          </div>
          <Button variant="secondary" onClick={createNewFlow} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Workflow
          </Button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>

        /* Empty state */
        ) : !flows || flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-lg border border-dashed text-center gap-4">
            <div className="rounded-full bg-muted p-4">
              <Workflow className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No workflows yet</p>
              <p className="text-sm text-muted-foreground">Create your first flow to automate complex tasks.</p>
            </div>
            <Button variant="outline" size="sm" onClick={createNewFlow}>
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </div>

        /* Flow cards */
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(flows || []).map((flow: any) => (
              <Card key={flow.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base font-semibold leading-snug line-clamp-1">
                      {flow.name || "Untitled Flow"}
                    </CardTitle>
                    <Badge variant="secondary" className="shrink-0 text-[11px] capitalize">
                      {flow.mode.charAt(0) + flow.mode.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2 text-sm leading-relaxed">
                    {flow.description || "No description provided."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Layers className="w-3.5 h-3.5" />
                    <span>
                      {flow.steps.length === 0
                        ? "No steps configured"
                        : `${flow.steps.length} step${flow.steps.length !== 1 ? "s" : ""}`}
                    </span>
                  </div>
                </CardContent>

                <Separator />

                <CardFooter className="pt-3 pb-3 flex items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    onClick={() => router.push(`/flows/run/${flow.id}`)}
                  >
                    <Play className="w-3.5 h-3.5 mr-2" />
                    Run
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => router.push(`/flows/builder/${flow.id}`)}
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteFlow(flow.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
