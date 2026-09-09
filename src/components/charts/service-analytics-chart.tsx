"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { CHART, GRID_STROKE, AXIS_TICK } from "./palette";

export function ServiceAnalyticsChart({
  data,
}: {
  data: { label: string; leads: number; bookings: number }[];
}) {
  const short = data.map((d) => ({ ...d, label: d.label.replace(" Cleaning", "").replace("Deep ", "") }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={short} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: GRID_STROKE, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="leads" name="Leads" fill={CHART.blue} radius={[3, 3, 0, 0]} />
        <Bar dataKey="bookings" name="Bookings" fill={CHART.green} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
