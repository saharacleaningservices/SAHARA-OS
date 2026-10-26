// The ONE primary action on a lead / booking page (owner 2026-10-24) — it changes with the status instead of showing a bar of buttons.
export type PrimaryActionKind = "CREATE_QUOTATION" | "CONFIRM_BOOKING" | "RESCHEDULE_JOB" | "SHARE_PDF" | "CONVERT_TO_INVOICE" | "NONE";

export type PrimaryActionInput = {
  stage: string;
  /** The enquiry already has a (non-deleted) job. */
  hasJob: boolean;
  jobStatus?: string | null;
  hasQuotation: boolean;
  hasInvoice: boolean;
  /** Super Admin / Accounts: may create quotations and see money documents. */
  canQuote: boolean;
};

export const PRIMARY_ACTION_LABEL: Record<PrimaryActionKind, string> = {
  CREATE_QUOTATION: "Create Quotation",
  CONFIRM_BOOKING: "Confirm Booking",
  RESCHEDULE_JOB: "Reschedule Job",
  SHARE_PDF: "Share PDF",
  CONVERT_TO_INVOICE: "Convert to Invoice",
  NONE: "",
};

export function primaryLeadAction(i: PrimaryActionInput): PrimaryActionKind {
  if (i.stage === "CANCELLED" || i.jobStatus === "CANCELLED") return "NONE";
  if (i.hasJob) {
    if (i.jobStatus === "COMPLETED" || i.stage === "COMPLETED") return i.hasInvoice ? (i.canQuote ? "SHARE_PDF" : "NONE") : i.canQuote ? "CONVERT_TO_INVOICE" : "NONE";
    return "RESCHEDULE_JOB";
  }
  if (i.stage === "COMPLETED") return "NONE";
  // New Inquiry (and the legacy Interested / Site Visit stages): quote first. Once a quotation exists — or it is a role that cannot
  // quote — the next step is confirming the booking.
  if (["NEW", "INTERESTED", "SITE_VISIT"].includes(i.stage) && !i.hasQuotation && i.canQuote) return "CREATE_QUOTATION";
  return "CONFIRM_BOOKING";
}
