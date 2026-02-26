"use client";

import { useEffect, useState } from "react";
import { NavHeader } from "@/components/nav-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Edit, Trash2, ArrowRight } from "lucide-react";
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My AI Workflows</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Automate multi-step processes by chaining AI agents together.
            </p>
          </div>
          <Button onClick={createNewFlow}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Flow
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !flows || flows.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground mb-6">Create your first flow to automate complex tasks.</p>
            <Button variant="outline" onClick={createNewFlow}>Create Flow</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(flows || []).map((flow: any) => (
              <Card key={flow.id} className="flex flex-col group">
                <CardHeader>
                  <CardTitle className="text-lg flex justify-between">
                    <span className="truncate">{flow.name}</span>
                    <Badge variant="outline" className="ml-2 font-mono text-[10px] bg-secondary/30">
                      {flow.mode}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[40px]">
                    {flow.description || "No description provided."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center flex-wrap gap-1 mt-2">
                    {flow.steps.length > 0 ? (
                      flow.steps.map((step: any, idx: number) => (
                        <div key={idx} className="flex items-center text-xs text-muted-foreground">
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground/80">
                            {step.webletId.substring(0, 8)}...
                          </span>
                          {idx < flow.steps.length - 1 && <ArrowRight className="w-3 h-3 mx-1 opacity-50" />}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No steps configured.</span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t flex justify-between bg-muted/10 gap-2">
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm"
                    onClick={() => router.push(`/flows/run/${flow.id}`)}
                  >
                    <Play className="w-3.5 h-3.5 mr-2" />
                    Run
                  </Button>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="px-3"
                      onClick={() => router.push(`/flows/builder/${flow.id}`)}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="px-3 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteFlow(flow.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
