"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarDays, Loader2, X } from "lucide-react";
import { requestBookingChange } from "@/server/actions/booking-page";
import { getDateAvailability, getSlotAvailability } from "@/server/actions/slot-availability";

const DONE = "Request sent — our team will confirm the change with you shortly. Your booking stays as it is until then.";

type Day = { date: string; available: boolean; status: "AVAILABLE" | "FILLING" | "FULL" };
type Slot = { slot: string; available: boolean };

const dayLabel = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/**
 * "Need a change?" on the customer booking page. Request Reschedule opens a calendar pop-up that lists ONLY dates and time slots that are
 * really open right now; Request Cancellation is a reason box and one tap. Both only send a REQUEST — the booking itself changes once
 * the office confirms.
 */
export function BookingChangeRequest({ token, bar = false }: { token: string; bar?: boolean }) {
  const [mode, setMode] = useState<"RESCHEDULE" | "CANCEL" | null>(null);
  const [msg, setMsg] = useState("");
  if (msg) return <p className="w-full rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>;
  return (
    <div className={bar ? "contents" : "space-y-2"}>
      {/* bar = the sticky action bar of the quotation view: Reschedule outline blue, Cancel danger outline (owner 2026-10-25). */}
      <div className={bar ? "contents" : "grid gap-2 sm:grid-cols-2"}>
        <button type="button" onClick={() => setMode("RESCHEDULE")} className={bar ? "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-[#1E40AF] bg-white px-2 text-sm font-bold text-[#1E40AF]" : "flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0a2540]/15 px-3 text-sm font-semibold"}>
          <CalendarDays className="size-4" /> {bar ? "Reschedule" : "Request Reschedule"}
        </button>
        <button type="button" onClick={() => setMode("CANCEL")} className={bar ? "min-h-11 flex-1 rounded-xl border-2 border-red-600 bg-white px-2 text-sm font-bold text-red-600" : "min-h-11 rounded-xl border border-[#0a2540]/15 px-3 text-sm font-semibold"}>
          {bar ? "Cancel" : "Request Cancellation"}
        </button>
      </div>
      {mode === "RESCHEDULE" && <ReschedulePanel token={token} onClose={() => setMode(null)} onDone={() => setMsg(DONE)} />}
      {mode === "CANCEL" && <CancelPanel token={token} onClose={() => setMode(null)} onDone={() => setMsg(DONE)} />}
    </div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 text-[#0a2540] shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <p className="text-base font-extrabold">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full hover:bg-[#0a2540]/5"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ReschedulePanel({ token, onClose, onDone }: { token: string; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    getDateAvailability(21).then((d) => setDays(d as Day[])).catch(() => setDays([]));
  }, []);
  useEffect(() => {
    if (!date) return;
    let live = true;
    getSlotAvailability(date).then((r) => live && setSlots(r.ok ? r.slots : [])).catch(() => live && setSlots([]));
    return () => {
      live = false;
    };
  }, [date]);

  const open = (days ?? []).filter((d) => d.available);
  const openSlots = (slots ?? []).filter((s) => s.available);
  return (
    <Sheet title="Choose a new date" onClose={onClose}>
      {!days ? (
        <p className="flex items-center gap-2 text-sm text-[#0a2540]/60"><Loader2 className="size-4 animate-spin" /> Checking live availability…</p>
      ) : open.length === 0 ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No open dates in the next three weeks. Please call us on 7083347130 / 8956567130.</p>
      ) : (
        <>
          <p className="text-xs text-[#0a2540]/60">Only dates and slots that are open right now are shown.</p>
          <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="Available dates">
            {open.map((d) => (
              <button
                key={d.date}
                type="button"
                role="option"
                aria-selected={date === d.date}
                onClick={() => {
                  setDate(d.date);
                  setSlots(null);
                  setSlot("");
                }}
                className={`min-h-14 rounded-xl border px-1 py-2 text-center text-xs font-semibold ${date === d.date ? "border-primary bg-primary text-primary-foreground" : "border-[#0a2540]/15"}`}
              >
                {dayLabel(d.date)}
                {d.status === "FILLING" && <span className={`block text-[10px] font-medium ${date === d.date ? "text-primary-foreground/80" : "text-amber-700"}`}>filling fast</span>}
              </button>
            ))}
          </div>
          {date && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Time slot on {dayLabel(date)}</p>
              {!slots ? (
                <p className="flex items-center gap-2 text-sm text-[#0a2540]/60"><Loader2 className="size-4 animate-spin" /> Loading slots…</p>
              ) : openSlots.length === 0 ? (
                <p className="text-sm text-amber-800">No slots left that day — pick another date.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {openSlots.map((s) => (
                    <button key={s.slot} type="button" onClick={() => setSlot(s.slot)} aria-pressed={slot === s.slot} className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${slot === s.slot ? "border-primary bg-primary text-primary-foreground" : "border-[#0a2540]/15"}`}>
                      {s.slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={pending || !date || !slot}
            onClick={() =>
              start(async () => {
                const res = await requestBookingChange(token, "RESCHEDULE", `Preferred slot: ${slot}`, date);
                if ("error" in res && res.error) return void setError(res.error);
                onDone();
              })
            }
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#0a2540] text-sm font-extrabold text-white disabled:opacity-50"
          >
            {pending ? "Sending…" : date && slot ? `Request ${dayLabel(date)} · ${slot}` : "Pick a date and a slot"}
          </button>
        </>
      )}
    </Sheet>
  );
}

function CancelPanel({ token, onClose, onDone }: { token: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Sheet title="Request cancellation" onClose={onClose}>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Reason (optional)" className="h-24 w-full rounded-xl border px-3 py-2 text-sm" aria-label="Reason for cancellation" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await requestBookingChange(token, "CANCEL", reason);
            if ("error" in res && res.error) return void setError(res.error);
            onDone();
          })
        }
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-red-600 text-sm font-extrabold text-white disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send Request"}
      </button>
    </Sheet>
  );
}
