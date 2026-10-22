"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight, Lock, LockOpen, CalendarRange } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
markAttendanceDay,
clearAttendanceDay,
bulkMarkAttendance,
closeAttendanceMonth,
reopenAttendanceMonth,
} from "@/server/actions/attendance";
import { cn } from "@/lib/utils";

type Day = {
day: number;
iso: string;
weekday: number;
isFuture: boolean;
status: "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE" | "WEEKLY_OFF" | null;
};

type Totals = {
present: number;
half: number;
absent: number;
leave: number;
weeklyOff: number;
payableDays: number;
};

const CODES = [
{ value: "PRESENT", code: "P", label: "Present" },
{ value: "ABSENT", code: "A", label: "Absent" },
{ value: "HALF_DAY", code: "H", label: "Half Day" },
{ value: "LEAVE", code: "L", label: "Leave" },
{ value: "WEEKLY_OFF", code: "WO", label: "Weekly Off" },
] as const;

// Same tone convention as the Staff page's P/H/A/L quick-mark buttons —
// Present = success, Absent = destructive. Half Day / Leave / Weekly Off get
// their own distinct, consistent tones so every status reads as a color at a
// glance in the compact grid.
const STYLE: Record<string, string> = {
PRESENT: "bg-success/15 text-success border-success/30",
ABSENT: "bg-destructive/15 text-destructive border-destructive/30",
HALF_DAY: "bg-warning/15 text-warning border-warning/40",
LEAVE: "bg-primary/10 text-primary border-primary/30",
WEEKLY_OFF: "bg-muted text-muted-foreground border-border",
};

// Small solid-color dots for the legend, matching the cell tones above.
const DOT: Record<string, string> = {
PRESENT: "bg-success",
ABSENT: "bg-destructive",
HALF_DAY: "bg-warning",
LEAVE: "bg-primary",
WEEKLY_OFF: "bg-muted-foreground/50",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Fixed column width for every cell — the grid stays a small, compact block
// (not a full-width Google-Calendar-style grid) regardless of the card's
// width, and matches on mobile without any horizontal scrolling.
const CELL = "size-7 sm:size-8";

export function MonthlyAttendanceCalendar({
staffId,
year,
month,
days,
totals,
closed,
canEdit,
canReopen,
}: {
staffId: string;
year: number;
month: number;
days: Day[];
totals: Totals;
closed: boolean;
canEdit: boolean;
canReopen: boolean;
}) {
const router = useRouter();
const [pending, startTransition] = useTransition();
const [openDay, setOpenDay] = useState<string | null>(null);
const [clearReason, setClearReason] = useState("");
const [bulk, setBulk] = useState({ from: "", to: "", status: "PRESENT" });

function go(y: number, m: number) {
const q = new URLSearchParams(window.location.search);
q.set("year", String(y));
q.set("month", String(m));
router.push(`${window.location.pathname}?${q.toString()}`);
}
const prev = () => (month === 1 ? go(year - 1, 12) : go(year, month - 1));
const next = () => (month === 12 ? go(year + 1, 1) : go(year, month + 1));

function setDay(iso: string, status: string) {
setOpenDay(null);
startTransition(async () => {
const res = await markAttendanceDay(staffId, iso, status as Day["status"] & string);
if (res?.error) {
toast.error(res.error);
return;
}
toast.success("Attendance saved");
router.refresh();
});
}

// Clear (unmark) a day — reason required; salary dues recalculate on their own (owner 2026-10-22).
function clearDay(iso: string) {
setOpenDay(null);
startTransition(async () => {
const res = await clearAttendanceDay(staffId, iso, clearReason);
if (res?.error) {
toast.error(res.error);
return;
}
setClearReason("");
toast.success("Day cleared — salary recalculated");
router.refresh();
});
}

function applyBulk() {
if (!bulk.from || !bulk.to) {
toast.error("Pick a start and end date");
return;
}
startTransition(async () => {
const res = await bulkMarkAttendance(staffId, bulk.from, bulk.to, bulk.status as Day["status"] & string);
if (res?.error) {
toast.error(res.error);
return;
}
toast.success(`Applied to ${res.applied} day(s)${res.skipped ? `, ${res.skipped} skipped` : ""}`);
setBulk({ from: "", to: "", status: "PRESENT" });
router.refresh();
});
}

function toggleClose() {
startTransition(async () => {
const res = closed
? await reopenAttendanceMonth(year, month)
: await closeAttendanceMonth(year, month);
if (res?.error) {
toast.error(res.error);
return;
}
toast.success(closed ? "Month reopened" : "Month closed — attendance & salary locked");
router.refresh();
});
}

const leading = days.length ? days[0].weekday : 0;
const editable = canEdit && !closed;

return (
<Card>
<CardHeader className="flex-row items-center justify-between space-y-0 gap-2">
<CardTitle className="flex items-center gap-2 text-base">
{MONTHS[month - 1]} {year}
{closed && (
<span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
<Lock className="size-3" /> Closed
</span>
)}
</CardTitle>
<div className="flex items-center gap-1">
<Button variant="outline" size="icon" className="size-7" onClick={prev} disabled={pending}>
<ChevronLeft className="size-3.5" />
</Button>
<Button variant="outline" size="icon" className="size-7" onClick={next} disabled={pending}>
<ChevronRight className="size-3.5" />
</Button>
</div>
</CardHeader>

<CardContent className="space-y-3">
<div className="inline-grid grid-cols-7 gap-1">
{WEEKDAYS.map((w, i) => (
<div key={i} className={cn(CELL, "flex items-center justify-center text-[10px] font-semibold uppercase text-muted-foreground")}>
{w}
</div>
))}
{Array.from({ length: leading }).map((_, i) => <div key={`x${i}`} className={CELL} />)}
{days.map((d) => {
const cell = (
<button
type="button"
disabled={!editable || d.isFuture || pending}
onClick={() => editable && !d.isFuture && setOpenDay(d.iso)}
className={cn(
CELL,
"flex flex-col items-center justify-center rounded-md border text-[9px] leading-none transition-colors",
d.status ? STYLE[d.status] : "border-border bg-card text-muted-foreground",
editable && !d.isFuture && "hover:border-primary/50 cursor-pointer",
d.isFuture && "opacity-40",
)}
>
<span className="text-[10px] font-medium">{d.day}</span>
<span className="font-semibold">
{d.status ? CODES.find((c) => c.value === d.status)?.code : "·"}
</span>
</button>
);
if (!editable || d.isFuture) return <div key={d.iso}>{cell}</div>;
return (
<Popover key={d.iso} open={openDay === d.iso} onOpenChange={(o) => setOpenDay(o ? d.iso : null)}>
<PopoverTrigger asChild>{cell}</PopoverTrigger>
<PopoverContent className="w-52 p-1.5">
<p className="px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground">
{new Date(d.iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
</p>
<div className="grid gap-1">
{CODES.map((c) => (
<button
key={c.value}
onClick={() => setDay(d.iso, c.value)}
className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
>
{c.label}
<span className="text-xs font-semibold text-muted-foreground">{c.code}</span>
</button>
))}
</div>
{d.status && (
<div className="mt-1 space-y-1 border-t border-border pt-1.5">
<input
value={clearReason}
onChange={(e) => setClearReason(e.target.value)}
placeholder="Reason to clear this day"
aria-label="Reason to clear this day"
className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
/>
<button
type="button"
disabled={clearReason.trim().length < 3}
onClick={() => clearDay(d.iso)}
className="w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-40"
>
Clear day (unmark)
</button>
</div>
)}
</PopoverContent>
</Popover>
);
})}
</div>

<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
<span className="flex items-center gap-1"><i className={cn("size-2 rounded-full", DOT.PRESENT)} /><b className="text-success">{totals.present}</b> Present</span>
<span className="flex items-center gap-1"><i className={cn("size-2 rounded-full", DOT.HALF_DAY)} /><b className="text-warning">{totals.half}</b> Half</span>
<span className="flex items-center gap-1"><i className={cn("size-2 rounded-full", DOT.ABSENT)} /><b className="text-destructive">{totals.absent}</b> Absent</span>
<span className="flex items-center gap-1"><i className={cn("size-2 rounded-full", DOT.LEAVE)} /><b className="text-primary">{totals.leave}</b> Leave</span>
<span className="flex items-center gap-1"><i className={cn("size-2 rounded-full", DOT.WEEKLY_OFF)} /><b>{totals.weeklyOff}</b> Weekly Off</span>
<span className="ml-auto font-medium text-foreground">Payable: {totals.payableDays} days</span>
</div>

{editable && (
<details className="rounded-lg border border-dashed border-border">
<summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold text-foreground">
<CalendarRange className="size-3.5" /> Bulk mark a date range
</summary>
<div className="flex flex-wrap items-end gap-2 px-3 pb-3">
<label className="text-xs">
<span className="mb-1 block text-muted-foreground">From</span>
<input type="date" value={bulk.from} onChange={(e) => setBulk((b) => ({ ...b, from: e.target.value }))} className="rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
</label>
<label className="text-xs">
<span className="mb-1 block text-muted-foreground">To</span>
<input type="date" value={bulk.to} onChange={(e) => setBulk((b) => ({ ...b, to: e.target.value }))} className="rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
</label>
<Select value={bulk.status} onValueChange={(v) => setBulk((b) => ({ ...b, status: v }))}>
<SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
<SelectContent>
{CODES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
</SelectContent>
</Select>
<Button size="sm" onClick={applyBulk} disabled={pending}>
{pending && <Loader2 className="size-3.5 animate-spin" />} Apply
</Button>
</div>
</details>
)}

{(canEdit || canReopen) && (
<div className="flex justify-end">
{closed ? (
canReopen && (
<Button variant="outline" size="sm" onClick={toggleClose} disabled={pending}>
<LockOpen className="size-3.5" /> Reopen Month
</Button>
)
) : (
canEdit && (
<Button variant="outline" size="sm" onClick={toggleClose} disabled={pending}>
<Lock className="size-3.5" /> Close Month
</Button>
)
)}
</div>
)}
</CardContent>
</Card>
);
}
