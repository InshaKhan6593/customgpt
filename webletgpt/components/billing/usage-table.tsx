"use client";

import { formatDistanceToNow } from "date-fns";

interface UsageRecord {
  id: string;
  createdAt: string;
  creditsCharged: number;
  estimatedCost: number | string;
  metadata?: any;
}

interface UsageTableProps {
  records: UsageRecord[];
  emptyText?: string;
}

export function UsageTable({ records, emptyText = "No usage records yet." }: UsageTableProps) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Time</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Credits</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Est. Cost</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {records.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2.5 text-muted-foreground">
                {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
              </td>
              <td className="px-4 py-2.5 font-medium">{r.creditsCharged}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                ${Number(r.estimatedCost).toFixed(4)}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs truncate max-w-xs">
                {r.metadata?.model ?? r.metadata?.webletName ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
