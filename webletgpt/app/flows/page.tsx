"use client";

import { useEffect, useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Workflow, GitBranch, Clock, Layers, Bot } from "lucide-react";
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
          <div className="space-y-1">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Workflow className="size-4" />
              My Workflows
            </h2>
            <p className="text-sm text-muted-foreground">
              Chain AI agents together to automate multi-step tasks.
            </p>
          </div>
          <Button variant="secondary" onClick={createNewFlow} size="sm" className="text-sm gap-1.5 bg-secondary hover:bg-secondary/80 dark:bg-[#18181b] dark:hover:bg-[#27272a] dark:text-zinc-100 dark:border dark:border-zinc-800">
            <Plus className="size-3.5" />
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
              <Workflow className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">No workflows yet</p>
              <p className="text-sm text-muted-foreground">Create your first flow to automate complex tasks.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={createNewFlow} className="text-sm gap-1.5 bg-secondary hover:bg-secondary/80 dark:bg-[#18181b] dark:hover:bg-[#27272a] dark:text-zinc-100 dark:border dark:border-zinc-800">
              <Plus className="size-3.5" />
              Create Workflow
            </Button>
          </div>

          /* Flow cards */
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(flows || []).map((flow: any) => {
              const stepCount = (flow.steps as any[])?.length || 0;
              const hasPrompt = !!flow.defaultPrompt?.trim();
              const isReady = stepCount > 0 && hasPrompt;

              return (
                <div
                  key={flow.id}
                  className="group rounded-lg border bg-card p-6 flex flex-col gap-4 hover:border-primary/30 hover:bg-accent/50 transition-all duration-200 cursor-pointer"
                  onClick={() => router.push(`/flows/builder/${flow.id}`)}
                >
                  {/* Top: Icon + Status */}
                  <div className="flex items-start justify-between">
                    <div className="shrink-0 size-11 rounded-lg bg-muted flex items-center justify-center border">
                      <Workflow className="size-5 text-muted-foreground" />
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
                      {isReady ? "Ready" : "Draft"}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5 flex-1">
                    <h3 className="text-base font-semibold text-foreground tracking-tight truncate">
                      {flow.name || "Untitled Flow"}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {flow.description || "No description"}
                    </p>
                  </div>

                  {/* Agents used */}
                  {stepCount > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(flow.steps as any[]).map((step: any, si: number) => (
                        <span
                          key={si}
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-md px-2 py-1"
                        >
                          {step.webletIconUrl ? (
                            <img src={step.webletIconUrl} alt={step.webletName || "Agent"} width={16} height={16} loading="eager" className="size-4 rounded-sm object-cover shrink-0" />
                          ) : (
                            <Bot className="size-3.5 shrink-0" />
                          )}
                          <span className="truncate max-w-[120px]">
                            {step.webletName || "Agent"}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="size-3" />
                      {stepCount} {stepCount === 1 ? "agent" : "agents"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="size-3" />
                      {flow.mode?.toLowerCase() || "sequential"}
                    </span>
                    {flow.updatedAt && (
                      <span className="inline-flex items-center gap-1 ml-auto">
                        <Clock className="size-3" />
                        {new Date(flow.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/flows/builder/${flow.id}`);
                      }}
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFlow(flow.id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
