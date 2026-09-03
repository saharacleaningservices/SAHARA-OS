"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART, GRID_STROKE, AXIS_TICK } from "./palette";
import { formatINR } from "@/lib/utils";

const LABELS: Record<string, string> = { revenue: "Revenue", expenses: "Expenses", profit: "Net Profit" };

export function MonthlyProfitChart({
  data,
}: {
  data: { month: string; revenue: number; expenses: number; profit: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} width={48} />
        <Tooltip formatter={(value, name) => [formatINR(Number(value)), LABELS[String(name)] ?? String(name)]} contentStyle={{ borderRadius: 8, borderColor: GRID_STROKE, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => LABELS[String(v)] ?? String(v)} />
        <Bar dataKey="revenue" fill={CHART.blue} radius={[4, 4, 0, 0]} barSize={18} />
        <Bar dataKey="expenses" fill={CHART.amber} radius={[4, 4, 0, 0]} barSize={18} />
        <Line type="monotone" dataKey="profit" stroke={CHART.green} strokeWidth={2.5} dot={{ r: 3, fill: CHART.green }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
