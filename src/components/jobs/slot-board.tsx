"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { setDayControl, setSlotControl } from "@/server/actions/slot-control";

type Day = {
  date: string;
  booked: number;
  teams: number;
  dailyCapacity: number;
  isFull: boolean;
  slots: { slot: string; available: boolean }[];
  dayStatus: "AUTO" | "OPEN" | "FILLING" | "FULL";
  teamCapacity: number | null;
  slotStatus: Record<string, "AUTO" | "OPEN" | "FULL">;
  updatedByName: string | null;
};

const fmt = (d: string) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const BADGE: Record<string, string> = {
  OPEN: "bg-emerald-100 text-emerald-800",
  FILLING: "bg-amber-100 text-amber-800",
  FULL: "bg-red-100 text-red-700",
};

/** What the customer currently sees for this date. */
function customerStatus(d: Day): "OPEN" | "FILLING" | "FULL" {
  if (d.isFull) return "FULL";
  if (d.dayStatus === "FILLING") return "FILLING";
  if (d.dayStatus === "OPEN") return "OPEN";
  return d.booked >= Math.ceil(d.teams / 2) ? "FILLING" : "OPEN";
}

export function SlotBoard({ board }: { board: Day[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  const [cap, setCap] = useState<Record<string, string>>(() => Object.fromEntries(board.map((d) => [d.date, d.teamCapacity == null ? "" : String(d.teamCapacity)])));

  function run(key: string, fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setBusy(key);
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else toast.success("Availability updated");
      setBusy("");
      router.refresh();
    });
  }

  const sel = "h-10 min-w-0 rounded-lg border bg-background px-2 text-sm";
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {board.map((d) => {
        const cs = customerStatus(d);
        const capValue = cap[d.date] ?? "";
        return (
          <div key={d.date} className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{fmt(d.date)}</p>
                <p className="text-xs text-muted-foreground">
                  {d.booked} booked · {d.teams} team{d.teams === 1 ? "" : "s"} · day cap {d.dailyCapacity}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[cs]}`}>{cs === "FULL" ? "FULLY BOOKED" : cs}</span>
            </div>

            <div className="grid grid-cols-[1fr_5.5rem_auto] items-end gap-2">
              <label className="min-w-0 text-xs font-medium">
                Day status
                <select
                  className={`${sel} mt-1 w-full`}
                  value={d.dayStatus}
                  disabled={pending}
                  onChange={(e) => run(`${d.date}*`, () => setDayControl({ date: d.date, status: e.target.value, teamCapacity: capValue === "" ? null : Number(capValue) }))}
                >
                  <option value="AUTO">Auto</option>
                  <option value="OPEN">Open</option>
                  <option value="FILLING">Filling</option>
                  <option value="FULL">Fully booked</option>
                </select>
              </label>
              <label className="text-xs font-medium">
                Teams
                <input
                  inputMode="numeric"
                  className={`${sel} mt-1 w-full`}
                  placeholder="Auto"
                  value={capValue}
                  onChange={(e) => setCap((c) => ({ ...c, [d.date]: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(`${d.date}cap`, () => setDayControl({ date: d.date, status: d.dayStatus, teamCapacity: capValue === "" ? null : Number(capValue) }))}
                className="h-10 rounded-lg border px-3 text-sm font-semibold"
              >
                {busy === `${d.date}cap` ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </button>
            </div>

            <div className="space-y-1.5">
              {d.slots.filter((s) => s.slot !== "Flexible").map((s) => {
                const ctl = d.slotStatus[s.slot] ?? "AUTO";
                return (
                  <div key={s.slot} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      <span className={`mr-1.5 inline-block size-2 rounded-full ${s.available ? "bg-emerald-500" : "bg-red-500"}`} />
                      {s.slot}
                    </span>
                    <div className="flex shrink-0 overflow-hidden rounded-lg border text-xs font-semibold">
                      {(["AUTO", "OPEN", "FULL"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={pending}
                          onClick={() => ctl !== v && run(`${d.date}${s.slot}`, () => setSlotControl({ date: d.date, slot: s.slot, status: v }))}
                          className={`min-h-9 px-2.5 ${ctl === v ? (v === "FULL" ? "bg-red-600 text-white" : v === "OPEN" ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground") : "bg-background"}`}
                        >
                          {v === "AUTO" ? "Auto" : v === "OPEN" ? "Open" : "Full"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {d.updatedByName && <p className="text-[11px] text-muted-foreground">Last changed by {d.updatedByName}</p>}
          </div>
        );
      })}
    </div>
  );
}
