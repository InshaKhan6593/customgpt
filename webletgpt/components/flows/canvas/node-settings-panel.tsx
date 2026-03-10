"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Bot, Trash2 } from "lucide-react";
import { PREDEFINED_ROLES } from "@/lib/orchestrator/roles";
import type { FlowNode, WebletNodeData, PromptNodeData } from "./types";
import { useState } from "react";

interface NodeSettingsPanelProps {
  node: FlowNode;
  onUpdate: (nodeId: string, data: Partial<WebletNodeData | PromptNodeData>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeSettingsPanel({ node, onUpdate, onDelete, onClose }: NodeSettingsPanelProps) {
  if (node.type === "prompt") {
    return (
      <PromptSettings
        node={node}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    );
  }


  // Weblet node
  return (
    <WebletSettings
      node={node}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}

function PanelHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function PromptSettings({
  node,
  onUpdate,
  onClose,
}: {
  node: FlowNode;
  onUpdate: NodeSettingsPanelProps["onUpdate"];
  onClose: () => void;
}) {
  const data = node.data as PromptNodeData;

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title="Input Prompt"
        subtitle="The starting message for your workflow"
        onClose={onClose}
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Default Prompt</Label>
          <Textarea
            value={data.prompt || ""}
            onChange={(e) => onUpdate(node.id, { prompt: e.target.value })}
            placeholder="e.g. Write a research report on AI trends in 2025..."
            className="text-sm resize-none min-h-[120px]"
            rows={5}
          />
          <p className="text-[10px] text-muted-foreground">
            Pre-fills when running this flow. Users can edit it before execution.
          </p>
        </div>
      </div>
    </div>
  );
}

function WebletSettings({
  node,
  onUpdate,
  onDelete,
  onClose,
}: {
  node: FlowNode;
  onUpdate: NodeSettingsPanelProps["onUpdate"];
  onDelete: NodeSettingsPanelProps["onDelete"];
  onClose: () => void;
}) {
  const data = node.data as WebletNodeData;
  const [imgErr, setImgErr] = useState(false);
  const iconSrc = data.iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(data.webletName || "agent")}&size=64`;

  return (
    <div className="flex flex-col h-full">
      <PanelHeader
        title={data.webletName || "Agent Settings"}
        subtitle={data.category || "Configure this agent"}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Agent info header */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
          <div className="size-10 rounded-lg overflow-hidden border border-border bg-background shrink-0">
            {imgErr ? (
              <div className="size-full flex items-center justify-center">
                <Bot className="size-5 text-muted-foreground" />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconSrc} alt={data.webletName} className="size-full object-cover" onError={() => setImgErr(true)} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{data.webletName}</p>
            <p className="text-xs text-muted-foreground truncate">{data.description || data.category}</p>
          </div>
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label className="text-xs">Agent Role</Label>
          <Select
            value={data.role || ""}
            onValueChange={(val) => onUpdate(node.id, { role: val })}
          >
            <SelectTrigger className="h-9 w-full">
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

        {/* Instructions */}
        <div className="space-y-1.5">
          <Label className="text-xs">Instructions for this Agent</Label>
          <Textarea
            value={data.stepPrompt || ""}
            onChange={(e) => onUpdate(node.id, { stepPrompt: e.target.value })}
            placeholder="Tell this agent exactly what to do..."
            className="text-sm resize-none min-h-[100px]"
            rows={4}
          />
          <p className="text-[10px] text-muted-foreground">
            Injected into this agent&apos;s system prompt at runtime.
          </p>
        </div>

        {/* HITL toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div className="space-y-0.5">
            <Label className="text-xs">Human in the Loop</Label>
            <p className="text-[10px] text-muted-foreground">Pause for approval after this agent.</p>
          </div>
          <Switch
            checked={data.hitlGate || false}
            onCheckedChange={(val) => onUpdate(node.id, { hitlGate: val })}
          />
        </div>

        {/* Delete */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          onClick={() => {
            onDelete(node.id);
            onClose();
          }}
        >
          <Trash2 className="size-3.5 mr-2" />
          Remove Agent
        </Button>
      </div>
    </div>
  );
}
