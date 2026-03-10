"use client";

import { useState, useMemo } from "react";
import { Search, Bot, GripVertical, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WebletItem } from "./types";

interface WebletSidebarProps {
  weblets: WebletItem[];
  onWebletClick?: (weblet: WebletItem) => void;
}

export function WebletSidebar({ weblets, onWebletClick }: WebletSidebarProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return weblets;
    const q = search.toLowerCase();
    return weblets.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        w.description?.toLowerCase().includes(q)
    );
  }, [weblets, search]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, WebletItem[]>();
    for (const w of filtered) {
      const cat = w.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(w);
    }
    return map;
  }, [filtered]);

  const onDragStart = (e: React.DragEvent, weblet: WebletItem) => {
    e.dataTransfer.setData("application/weblet", JSON.stringify(weblet));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-zinc-100 dark:border-white/5">
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-4 tracking-tight">Available Agents</h3>
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500 transition-colors" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="h-10 pl-10 text-sm font-medium text-zinc-100 bg-zinc-50 dark:bg-black/40 border-zinc-200 dark:border-white/10 focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700 transition-all rounded-xl shadow-none"
          />
        </div>
      </div>

      {/* Weblet list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bot className="size-8 text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No agents found matching &quot;{search}&quot;</p>
          </div>
        )}

        <div className="space-y-4 mt-6 mb-4">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 px-2 mb-3">
                {category}
              </p>
              <div className="space-y-2">
                {items.map((w) => (
                  <WebletDragItem key={w.id} weblet={w} onDragStart={onDragStart} onWebletClick={onWebletClick} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentIcon({ iconUrl, name }: { iconUrl: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const src = iconUrl || `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(name)}&size=64`;

  if (err) return <Bot className="size-4 text-muted-foreground" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="size-full rounded-sm object-cover"
      onError={() => setErr(true)}
    />
  );
}

function WebletDragItem({
  weblet,
  onDragStart,
  onWebletClick,
}: {
  weblet: WebletItem;
  onDragStart: (e: React.DragEvent, w: WebletItem) => void;
  onWebletClick?: (weblet: WebletItem) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, weblet)}
      onClick={() => onWebletClick?.(weblet)}
      className="flex items-center gap-3 py-2 px-2.5 pr-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:cursor-pointer
        bg-white dark:bg-[#0a0a0a] border border-zinc-100 dark:border-white/5
        hover:dark:bg-white/[0.02] hover:dark:border-white/10 hover:border-zinc-200 hover:shadow-sm hover:bg-zinc-50  
        transition-all duration-200 group relative"
    >
      <div className="size-8 shrink-0 flex items-center justify-center">
        <AgentIcon iconUrl={weblet.iconUrl} name={weblet.name} />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center pr-6">
        <p className="text-[13px] font-bold text-zinc-900 dark:text-zinc-50 truncate">{weblet.name}</p>
        <p className="text-[12px] font-medium text-zinc-500 dark:text-zinc-500 truncate mt-0.5">
          {weblet.description ? weblet.description : "Agent node"}
        </p>
      </div>

      <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Popover>
          <PopoverTrigger asChild>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <MoreVertical className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" sideOffset={10} className="w-64 p-3 bg-white dark:bg-[#0a0a0a] border border-zinc-200 dark:border-white/10 shadow-xl rounded-xl">
            <div className="flex flex-col gap-1.5">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{weblet.name}</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {weblet.description || "No description available for this agent."}
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div >
  );
}
