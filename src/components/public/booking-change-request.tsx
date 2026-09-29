"use client";

import { useState, useTransition } from "react";
import { requestBookingChange } from "@/server/actions/booking-page";

type Kind = "RESCHEDULE" | "POSTPONE" | "CANCEL";
const OPTIONS: { kind: Kind; label: string }[] = [
  { kind: "RESCHEDULE", label: "Request Reschedule" },
  { kind: "POSTPONE", label: "Request Postponement" },
  { kind: "CANCEL", label: "Request Cancellation" },
];

/** Sends a change REQUEST to the office — the booking itself only changes once the team confirms. */
export function BookingChangeRequest({ token }: { token: string }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  if (msg) return <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{msg}</p>;
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <button key={o.kind} type="button" onClick={() => setKind(o.kind)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${kind === o.kind ? "border-primary bg-primary/5" : "border-[#0a2540]/15"}`}>
            {o.label}
          </button>
        ))}
      </div>
      {kind && (
        <div className="space-y-2">
          {kind !== "CANCEL" && (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full rounded-xl border px-3 text-sm" aria-label="Preferred new date" />
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / preferred time (optional)" className="h-16 w-full rounded-xl border px-3 py-2 text-sm" />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await requestBookingChange(token, kind, note, date || undefined);
                setMsg("error" in res && res.error ? res.error : "Request sent — our team will confirm the change with you shortly. Your booking stays as it is until then.");
              })
            }
            className="w-full rounded-xl bg-[#0a2540] py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send request"}
          </button>
        </div>
      )}
    </div>
  );
}
