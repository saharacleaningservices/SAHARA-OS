"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SlotBoard } from "@/components/jobs/slot-board";
import { TWO_HOUR_SLOTS } from "@/lib/slot-matrix";

type BoardDay = Parameters<typeof SlotBoard>[0]["board"][number];
type MatrixJob = { id: string; date: string; time: string; slot: number; customerName: string; area: string; service: string; teamNumber: number | null; status: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TONE: Record<string, string> = {
  OPEN: "border-emerald-200 bg-emerald-50/60",
  FILLING: "border-amber-200 bg-amber-50/70",
  FULL: "border-red-200 bg-red-50/70",
  PAST: "border-border bg-muted/40 text-muted-foreground",
};
const DOT: Record<string, string> = { OPEN: "bg-emerald-500", FILLING: "bg-amber-500", FULL: "bg-red-500", PAST: "bg-muted-foreground/40" };

function customerStatus(d: BoardDay): "OPEN" | "FILLING" | "FULL" {
  if (d.isFull) return "FULL";
  if (d.dayStatus === "FILLING") return "FILLING";
  if (d.dayStatus === "OPEN") return "OPEN";
  return d.booked >= Math.ceil(d.teams / 2) ? "FILLING" : "OPEN";
}
const dayNum = (iso: string) => Number(iso.slice(8, 10));
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
const monthLabel = (iso: string) => new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });

/**
 * CRM → Jobs → Slot Availability: 7 × 5 month matrix (Mon–Sun, this week + 4). Each cell shows the customer-facing
 * status and one dot per 2-hour window; tapping a day opens a drawer with that day's jobs per 2-hour window and the
 * existing day / slot overrides. Fluid layout: full width on desktop, compact cells + bottom sheet on phones.
 */
export function SlotMonthMatrix({ today, dates, board, jobs }: { today: string; dates: string[]; board: BoardDay[]; jobs: MatrixJob[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(board.map((d) => [d.date, d])), [board]);
  const jobsByDate = useMemo(() => {
    const m = new Map<string, MatrixJob[]>();
    for (const j of jobs) m.set(j.date, [...(m.get(j.date) ?? []), j]);
    return m;
  }, [jobs]);
  const sel = open ? byDate.get(open) ?? null : null;
  const selJobs = open ? jobsByDate.get(open) ?? [] : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {(["OPEN", "FILLING", "FULL"] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`inline-block size-2.5 rounded-full ${DOT[k]}`} /> {k === "FULL" ? "Fully booked" : k === "OPEN" ? "Open" : "Filling"}
          </span>
        ))}
        <span>· dots = 8–10, 10–12, 12–2, 2–4, 4–6</span>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{w}</div>
        ))}
        {dates.map((iso) => {
          const d = byDate.get(iso);
          const past = iso < today || !d;
          const cs = past ? "PAST" : customerStatus(d!);
          const count = jobsByDate.get(iso)?.length ?? 0;
          const first = iso === dates[0] || dayNum(iso) === 1;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setOpen(iso)}
              className={`flex min-h-16 flex-col items-stretch rounded-lg border p-1.5 text-left transition hover:shadow-sm sm:min-h-24 sm:rounded-xl sm:p-2 ${TONE[cs]} ${iso === today ? "ring-2 ring-primary" : ""}`}
              aria-label={`${longDate(iso)}: ${cs === "PAST" ? "past" : cs.toLowerCase()}, ${count} job${count === 1 ? "" : "s"}`}
            >
              <span className="flex items-baseline justify-between gap-1">
                <span className="text-sm font-bold leading-none sm:text-base">{dayNum(iso)}</span>
                {first && <span className="hidden text-[10px] font-medium uppercase sm:inline">{monthLabel(iso)}</span>}
              </span>
              {d && !past ? (
                <span className="mt-auto flex gap-0.5 pt-1" aria-hidden>
                  {d.slots.filter((x) => x.slot !== "Flexible").map((x) => (
                    <span key={x.slot} className={`inline-block size-1.5 rounded-full sm:size-2 ${x.available ? "bg-emerald-500" : "bg-red-500"}`} />
                  ))}
                </span>
              ) : (
                <span className="mt-auto" />
              )}
              {count > 0 && (
                <span className="mt-1 hidden text-[11px] font-medium sm:block">
                  {count} job{count === 1 ? "" : "s"}{d && !past ? ` · ${d.booked}/${d.dailyCapacity}` : ""}
                </span>
              )}
              {count > 0 && <span className="mt-0.5 text-[10px] font-semibold sm:hidden">{count}</span>}
            </button>
          );
        })}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {open && (
            <div className="space-y-4 p-4">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle>{longDate(open)}</SheetTitle>
                <SheetDescription>
                  {selJobs.length} job{selJobs.length === 1 ? "" : "s"}
                  {sel ? ` · ${sel.teams} team${sel.teams === 1 ? "" : "s"} · day cap ${sel.dailyCapacity}` : " · past date (read-only)"}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-2">
                {[...TWO_HOUR_SLOTS.map((label, i) => ({ label, i })), { label: "Flexible / other time", i: -1 }].map(({ label, i }) => {
                  const list = selJobs.filter((j) => j.slot === i);
                  if (i === -1 && list.length === 0) return null;
                  const avail = sel?.slots.find((s) => s.slot === label)?.available;
                  return (
                    <div key={label} className="rounded-lg border p-2.5">
                      <p className="flex items-center justify-between text-sm font-semibold">
                        <span className="flex items-center gap-1.5">
                          {avail !== undefined && <span className={`inline-block size-2 rounded-full ${avail ? "bg-emerald-500" : "bg-red-500"}`} />}
                          {label}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">{list.length}</span>
                      </p>
                      {list.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {list.map((j) => (
                            <li key={j.id}>
                              <Link href={`/jobs/${j.id}`} className="block rounded-md px-1.5 py-1 text-sm hover:bg-muted">
                                <span className="font-medium">{j.customerName}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {j.time} · {j.area || "—"}{j.teamNumber ? ` · Team ${j.teamNumber}` : " · no team"}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {sel && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Availability controls</p>
                  <SlotBoard board={[sel]} />
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
