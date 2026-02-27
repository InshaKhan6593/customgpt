"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/nav-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Play, Save, Wand2, Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PREDEFINED_ROLES } from "@/lib/orchestrator/roles";
import { use } from "react";

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = use(params);

  const [flow, setFlow] = useState<any>(null);
  const [weblets, setWeblets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load flow and available weblets
  useEffect(() => {
    const loadData = async () => {
      try {
        const [flowRes, webletsRes] = await Promise.all([
          fetch(`/api/flows/${id}`),
          fetch(`/api/marketplace/weblets?limit=50&all=true`) // Fetch all weblets (including private/inactive) for MVP builder
        ]);

        const flowData = await flowRes.json();

        if (flowRes.ok) {
          setFlow(flowData);

          if (webletsRes.ok) {
            const webletsData = await webletsRes.json();
            // The paginated API response structure is { data: [...], meta: {...} }
            setWeblets(Array.isArray(webletsData.data) ? webletsData.data : []);
          } else {
            setWeblets([]);
          }
        } else {
          toast({ title: "Error", description: flowData.error || "Failed to load flow", variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "Error", description: "Network error loading builder", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, toast]);

  const saveFlow = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/flows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: flow.name,
          mode: flow.mode,
          steps: flow.steps,
        })
      });
      if (res.ok) {
        toast({ title: "Saved", description: "Workflow saved successfully." });
      } else {
        toast({ title: "Error", description: "Failed to save workflow.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Network error saving workflow.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addStep = () => {
    setFlow((prev: any) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          webletId: "",
          order: prev.steps.length + 1,
          inputMapping: prev.steps.length === 0 ? "original" : "previous",
          hitlGate: false,
          role: "",
        }
      ]
    }));
  };

  const updateStep = (index: number, field: string, value: any) => {
    setFlow((prev: any) => {
      const newSteps = [...prev.steps];
      newSteps[index] = { ...newSteps[index], [field]: value };
      return { ...prev, steps: newSteps };
    });
  };

  const removeStep = (index: number) => {
    setFlow((prev: any) => {
      const newSteps = prev.steps.filter((_: any, i: number) => i !== index);
      // Re-adjust order
      const reordered = newSteps.map((s: any, i: number) => ({ ...s, order: i + 1 }));
      return { ...prev, steps: reordered };
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === flow.steps.length - 1) return;

    setFlow((prev: any) => {
      const newSteps = [...prev.steps];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      // Swap
      const temp = newSteps[index];
      newSteps[index] = newSteps[targetIndex];
      newSteps[targetIndex] = temp;

      // Re-adjust order
      const reordered = newSteps.map((s: any, i: number) => ({ ...s, order: i + 1 }));

      // Fix input mapping if first step is moved
      if (reordered.length > 0) {
        reordered[0].inputMapping = "original";
      }

      return { ...prev, steps: reordered };
    });
  };

  const autoSuggestTeam = async () => {
    const task = prompt("Describe the task you want the AI team to accomplish:");
    if (!task || !task.trim()) return;

    toast({ title: "Auto-Suggesting Team", description: "Asking AI to recommend the perfect team..." });
    try {
      const res = await fetch("/api/flows/auto-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: "Failed", description: data.error || "Could not get suggestion", variant: "destructive" });
        return;
      }

      // Apply the suggested team to the flow
      const suggestedSteps = data.suggestedTeam.map((member: any, idx: number) => ({
        webletId: member.webletId,
        order: idx + 1,
        inputMapping: idx === 0 ? "original" : "previous",
        hitlGate: false,
        role: member.role,
      }));

      setFlow((prev: any) => ({
        ...prev,
        mode: data.executionMode || prev.mode,
        steps: suggestedSteps,
      }));

      toast({
        title: "Team Formed!",
        description: `AI suggested ${suggestedSteps.length} agent(s) in ${data.executionMode} mode. ${data.reasoning}`,
      });
    } catch (err) {
      toast({ title: "Failed", description: "AI could not suggest a team.", variant: "destructive" });
    }
  };

  if (loading || !flow) {
    return (
      <div className="flex flex-col min-h-svh bg-background">
        <NavHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-svh bg-background">
      <NavHeader />

      {/* Top Bar */}
      <div className="border-b bg-card py-4 px-6 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <Button variant="ghost" size="icon" onClick={() => router.push("/flows")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 max-w-sm">
            <Input
              value={flow.name}
              onChange={(e) => setFlow({ ...flow, name: e.target.value })}
              className="font-bold text-lg border-transparent hover:border-border focus-visible:bg-background"
            />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={autoSuggestTeam}>
            <Wand2 className="w-4 h-4 mr-2" />
            Auto-Suggest Team
          </Button>
          <Button variant="outline" onClick={saveFlow} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="secondary" onClick={() => router.push(`/flows/run/${id}`)}>
            <Play className="w-4 h-4 mr-2" />
            Run Flow
          </Button>
        </div>
      </div>

      <main className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 md:p-8 gap-8">

        {/* Left Sidebar - Config */}
        <aside className="w-full md:w-64 space-y-6">
          <div>
            <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Execution Mode</Label>
            <Select
              value={flow.mode}
              onValueChange={(val) => setFlow({ ...flow, mode: val })}
            >
              <SelectTrigger className="mt-2 w-full">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEQUENTIAL">Sequential</SelectItem>
                <SelectItem value="HYBRID" disabled>Hybrid (Master Agent) - Coming Soon</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Sequential runs each agent one after another. Hybrid relies on a Master Agent to delegate tasks dynamically.
            </p>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Workflow Steps</h2>
            <Button variant="secondary" size="sm" onClick={addStep}>
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>

          <div className="space-y-4">
            {flow.steps.length === 0 ? (
              <div className="text-center py-20 bg-muted/30 border border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No agents added to this flow yet.</p>
                <Button variant="outline" onClick={addStep}>Add your first agent</Button>
              </div>
            ) : (
              flow.steps.map((step: any, index: number) => (
                <Card key={index} className="relative border shadow-sm group">
                  <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 flex flex-col items-center space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => moveStep(index, 'up')} disabled={index === 0}>
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => moveStep(index, 'down')} disabled={index === flow.steps.length - 1}>
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>

                  <CardHeader className="py-3 flex flex-row items-center justify-between space-y-0 text-zinc-100">
                    <CardTitle className="text-base font-medium flex items-center">
                      <span className="bg-primary/10 text-primary w-5 h-5 rounded-full flex items-center justify-center text-[10px] mr-2">
                        {index + 1}
                      </span>
                      Step {index + 1}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeStep(index)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </CardHeader>

                  <CardContent className="space-y-4 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

                      <div className="space-y-1.5 md:col-span-5">
                        <Label className="text-xs">Select Agent (Weblet)</Label>
                        <Select
                          value={step.webletId}
                          onValueChange={(val) => updateStep(index, "webletId", val)}
                        >
                          <SelectTrigger className={cn("h-9 w-full min-w-0 [&>span]:truncate", !step.webletId && "border-dashed border-red-300")}>
                            <SelectValue placeholder="Choose an agent..." />
                          </SelectTrigger>
                          <SelectContent>
                            {weblets.map(w => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name} <span className="text-[10px] text-muted-foreground">({w.category})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 md:col-span-4">
                        <Label className="text-xs">Agent Role</Label>
                        <Select
                          value={step.role || ""}
                          onValueChange={(val) => updateStep(index, "role", val)}
                        >
                          <SelectTrigger className="h-9 w-full min-w-0 [&>span]:truncate">
                            <SelectValue placeholder="Assign a role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {PREDEFINED_ROLES.map((role) => (
                              <SelectItem key={role.id} value={role.label}>
                                {role.label} — <span className="text-[10px] text-muted-foreground">{role.description}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5 md:col-span-3">
                        <Label className="text-xs">Input Data Source</Label>
                        <Select
                          value={step.inputMapping}
                          onValueChange={(val) => updateStep(index, "inputMapping", val)}
                          disabled={index === 0}
                        >
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue placeholder="Where from?" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="original">Original Prompt</SelectItem>
                            {index > 0 && <SelectItem value="previous">Previous Step Output</SelectItem>}
                          </SelectContent>
                        </Select>
                        {index === 0 && <p className="text-[9px] text-muted-foreground leading-tight">First step uses original prompt.</p>}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Human in the Loop</Label>
                        <p className="text-[10px] text-muted-foreground">Pause for manual approval before this step.</p>
                      </div>
                      <Switch
                        checked={step.hitlGate}
                        onCheckedChange={(val) => updateStep(index, "hitlGate", val)}
                        className="scale-90"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {flow.steps.length > 0 && (
              <div className="flex justify-center mt-6">
                <Button variant="ghost" onClick={addStep} className="border border-dashed w-full max-w-sm">
                  <Plus className="w-4 h-4 mr-2 text-muted-foreground" />
                  Append another step
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
