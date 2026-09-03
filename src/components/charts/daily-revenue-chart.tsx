"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART, GRID_STROKE, AXIS_TICK } from "./palette";
import { formatINR } from "@/lib/utils";

export function DailyRevenueChart({ data }: { data: { date: string; revenue: number; expenses: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} interval={4} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} width={48} />
        <Tooltip
          formatter={(value, name) => [formatINR(Number(value)), name === "revenue" ? "Revenue" : "Expenses"]}
          contentStyle={{ borderRadius: 8, borderColor: GRID_STROKE, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => (v === "revenue" ? "Revenue" : "Expenses")} />
        <Area type="monotone" dataKey="revenue" stroke={CHART.blue} fill="url(#revFill)" strokeWidth={2} dot={false} />
        <Area type="monotone" dataKey="expenses" stroke={CHART.amber} fill="transparent" strokeWidth={2} dot={false} strokeDasharray="4 3" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
