// One-click follow-up outcomes for owner-entered inquiries (pure — safe for client and server).
//
// An outcome is what the staff member REPORTS. It is recorded on the lead timeline + audit log and shown in the
// owner's tracker. It never changes the lead stage and never creates a quotation, booking, job or payment —
// those stay in their own workflows. "Quotation Sent" / "Booking Confirmed" are therefore shown as
// self-reported until the CRM itself confirms them (a quotation record / a confirmed or scheduled lead).

export const INQUIRY_OUTCOMES = [
  { key: "CALLED", label: "Called / Spoke to Customer", short: "Called", tone: "default" },
  { key: "FOLLOW_UP", label: "Follow-up Required", short: "Follow-up", tone: "outline" },
  { key: "QUOTATION_SENT", label: "Quotation Sent", short: "Quotation sent", tone: "outline" },
  { key: "NO_ANSWER", label: "No Answer", short: "No answer", tone: "outline" },
  { key: "NOT_INTERESTED", label: "Not Interested", short: "Not interested", tone: "outline" },
  { key: "BOOKING_CONFIRMED", label: "Booking Confirmed", short: "Booking confirmed", tone: "default" },
] as const;

export type InquiryOutcomeKey = (typeof INQUIRY_OUTCOMES)[number]["key"];
export const OUTCOME_KEYS: string[] = INQUIRY_OUTCOMES.map((o) => o.key);

export const outcomeLabel = (key: string) => INQUIRY_OUTCOMES.find((o) => o.key === key)?.label ?? key;
export const outcomeShort = (key: string) => INQUIRY_OUTCOMES.find((o) => o.key === key)?.short ?? key;

/** Outcomes that the CRM can cross-check; everything else is simply what the staff member reported. */
export type OutcomeCheck = { state: "CONFIRMED" | "NOT_CONFIRMED" | "SELF_REPORTED"; text: string };

export function checkOutcome(
  outcome: string,
  facts: { quotationCount: number; stage: string; jobCount: number },
): OutcomeCheck {
  if (outcome === "QUOTATION_SENT") {
    return facts.quotationCount > 0
      ? { state: "CONFIRMED", text: "Quotation exists in the CRM" }
      : { state: "NOT_CONFIRMED", text: "Reported by staff — no quotation created in the CRM yet" };
  }
  if (outcome === "BOOKING_CONFIRMED") {
    const booked = ["CONFIRMED", "JOB_SCHEDULED", "COMPLETED"].includes(facts.stage) || facts.jobCount > 0;
    return booked
      ? { state: "CONFIRMED", text: "Booking confirmed in the CRM" }
      : { state: "NOT_CONFIRMED", text: "Reported by staff — not confirmed in the CRM yet (use Confirm Booking)" };
  }
  return { state: "SELF_REPORTED", text: "Reported by staff" };
}

/** Optional next follow-up: must be a real future time within 30 days. Returns a Date or null (ignored when absent). */
export function parseNextFollowUp(v: unknown, now = Date.now()): { ok: true; at: Date | null } | { ok: false; error: string } {
  if (v === undefined || v === null || v === "") return { ok: true, at: null };
  if (typeof v !== "string") return { ok: false, error: "Invalid follow-up time" };
  // datetime-local values (no zone) are India time; a bare date means 10:00 AM IST.
  let iso = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = `${iso}T10:00:00+05:30`;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(iso)) iso = `${iso}:00+05:30`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid follow-up time" };
  if (d.getTime() <= now) return { ok: false, error: "Next follow-up must be in the future" };
  if (d.getTime() > now + 30 * 24 * 3600 * 1000) return { ok: false, error: "Next follow-up must be within 30 days" };
  return { ok: true, at: d };
}
