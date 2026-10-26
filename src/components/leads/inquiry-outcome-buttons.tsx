"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INQUIRY_OUTCOMES } from "@/lib/inquiry-outcomes";
import { recordMyInquiryOutcome } from "@/server/actions/owner-inquiry";

/**
 * One click records what happened (Called, Follow-up Required, Quotation Sent, No Answer, Not Interested,
 * Booking Confirmed). A note and a next follow-up date/time are optional and hidden until asked for.
 * The outcome is a report only: it never changes the lead stage or creates a quotation, booking or payment.
 */
export function InquiryOutcomeButtons({ leadId, alertId, onDone, compact }: { leadId: string; alertId?: string; onDone?: () => void; compact?: boolean }) {
  const [more, setMore] = useState(false);
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function record(outcome: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(outcome);
    try {
      const res = await recordMyInquiryOutcome({ leadId, outcome, note, nextFollowUp: next || undefined, alertId });
      if (res.ok) {
        toast.success("Recorded — Altaf can see this in the tracker");
        setNote("");
        setNext("");
        onDone?.();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Could not save — please try again");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className={`grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {INQUIRY_OUTCOMES.map((o) => (
          <Button key={o.key} size="sm" variant={o.tone === "default" ? "default" : "outline"} className="h-auto min-h-9 whitespace-normal py-1.5 text-xs leading-tight" disabled={busy !== null} onClick={() => void record(o.key)}>
            {busy === o.key ? "Saving…" : o.label}
          </Button>
        ))}
      </div>
      <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
        <ChevronDown className={`size-3 transition-transform ${more ? "" : "-rotate-90"}`} /> Add a note / next follow-up (optional)
      </button>
      {more && (
        <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/50 p-2">
          <Input className="h-8 min-w-40 flex-1 text-xs" maxLength={300} placeholder="Note (what the customer said)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Input className="h-8 w-auto text-xs" type="datetime-local" value={next} onChange={(e) => setNext(e.target.value)} aria-label="Next follow-up" />
        </div>
      )}
    </div>
  );
}
