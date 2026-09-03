"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { CHART, GRID_STROKE, AXIS_TICK } from "./palette";
import { STAFF_AVAILABILITY_LABELS } from "@/lib/constants";

export function StaffJobsChart({ data }: { data: { name: string; jobs: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip formatter={(value) => [String(value), "Jobs (30d)"]} contentStyle={{ borderRadius: 8, borderColor: GRID_STROKE, fontSize: 12 }} />
        <Bar dataKey="jobs" fill={CHART.blue} radius={[4, 4, 0, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: CHART.green,
  ON_JOB: CHART.blue,
  ON_LEAVE: CHART.gray,
  OFF_DUTY: CHART.red,
};

export function AvailabilityPieChart({ data }: { data: { status: string; count: number }[] }) {
  const chartData = data.filter((d) => d.count > 0).map((d) => ({ ...d, label: STAFF_AVAILABILITY_LABELS[d.status] }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={chartData} dataKey="count" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {chartData.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLOR[entry.status]} stroke="var(--card)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 8, borderColor: GRID_STROKE, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
