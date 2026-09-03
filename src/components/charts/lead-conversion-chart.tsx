"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import { CHART, GRID_STROKE, AXIS_TICK } from "./palette";
import { LEAD_STAGE_LABELS } from "@/lib/constants";

export function LeadConversionChart({ data }: { data: { stage: string; count: number }[] }) {
  const chartData = data.map((d) => ({ ...d, label: LEAD_STAGE_LABELS[d.stage] ?? d.stage }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} width={90} />
        <Tooltip formatter={(value) => [String(value), "Leads reached this stage or further"]} contentStyle={{ borderRadius: 8, borderColor: GRID_STROKE, fontSize: 12 }} />
        <Bar dataKey="count" fill={CHART.blue} radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList dataKey="count" position="right" style={{ fill: "#0A2540", fontSize: 11, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
