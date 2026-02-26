"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart } from "recharts";

interface DailyTrendData {
  date: string;
  chats: number;
  revenue: number;
}

export function OverviewTrendChart({ data }: { data: DailyTrendData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[350px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No data available for this period.
      </div>
    );
  }

  return (
    <div className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
               <stop offset="0%" stopColor="#a855f7" stopOpacity={0.9} />
               <stop offset="100%" stopColor="#a855f7" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
            dy={10}
          />
          <YAxis 
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `$${value}`}
            tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          />
          <Tooltip 
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-border)", backgroundColor: "var(--color-background)", color: "var(--color-foreground)" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          <Bar yAxisId="left" dataKey="chats" name="Total Chats" fill="url(#purpleGrad)" radius={[2, 2, 0, 0]} maxBarSize={12} activeBar={{ style: { outline: "none" } }} className="hover:fill-purple-400 transition-colors" />
          <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue ($)" stroke="#14b8a6" strokeWidth={3} dot={false} activeDot={{ r: 6, style: { outline: "none" } }} strokeLinecap="round" strokeLinejoin="round" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
