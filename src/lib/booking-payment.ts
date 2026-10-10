// Public (unauthenticated) booking requests can never prove a payment or set an
// authoritative price. These pure helpers keep that rule in one testable place.
// There is no payment gateway: anything the customer "declares" stays pending
// verification until staff record it in the CRM (authenticated actions only).

/**
 * Advance rule: the standard booking terms say "50% advance payment confirms the booking; balance is
 * due on job completion" (QUOTATION_TERMS). One number, used by the booking summary and confirmation.
 * Display only — the server re-prices, and a payment is never marked paid until staff record it.
 */
export const ADVANCE_PERCENT = 50;

/**
 * Customer-facing payment details from CRM Settings (owner-maintained). Null when nothing is set up,
 * so the confirmation falls back to "our team will share them" — bank details are never hard-coded.
 */
export function paymentDetailsFrom(s: {
  upiId?: string | null; upiQrUrl?: string | null; bankName?: string | null;
  bankAccountName?: string | null; bankAccountNumber?: string | null; bankIfsc?: string | null;
} | null | undefined) {
  if (!s || !(s.upiQrUrl || s.bankAccountNumber || s.upiId)) return null;
  return {
    upiId: s.upiId ?? null,
    upiQrUrl: s.upiQrUrl ?? null,
    bankName: s.bankName ?? null,
    bankAccountName: s.bankAccountName ?? null,
    bankAccountNumber: s.bankAccountNumber ?? null,
    bankIfsc: s.bankIfsc ?? null,
  };
}

/** Total / advance payable now / remaining after service. Pay-after-service means no advance. */
export function advanceBreakdown(total: number, pay: "PAY_ADVANCE" | "PAY_AFTER_SERVICE" | "") {
  const t = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
  const advance = pay === "PAY_ADVANCE" ? Math.round((t * ADVANCE_PERCENT) / 100) : 0;
  return { total: t, advance, remaining: t - advance };
}

/** Payment state for a public booking: always unpaid/pending, whatever the browser sent. */
export function publicPaymentState(input: { advancePaid?: boolean; advanceAmount?: number | null }) {
  const declared = input.advancePaid && input.advanceAmount && input.advanceAmount > 0 ? input.advanceAmount : 0;
  return {
    /** Verified advance recorded on the lead / Payment row — always 0 for public requests. */
    advance: 0,
    paymentStatus: "PENDING_ADVANCE" as const,
    /** What the customer claimed (UNVERIFIED) — kept only as a staff note. */
    declaredAdvance: declared,
    createPaymentRow: false as const,
  };
}

/**
 * Quote amount for a public booking. Only a server-priced catalogue total is
 * authoritative; a browser-supplied estimate is kept as an unverified staff note.
 */
export function resolvePublicEstimate(input: { catalogueTotal: number | null; clientEstimate?: number | null }) {
  const clientEstimate = input.clientEstimate && input.clientEstimate > 0 ? input.clientEstimate : null;
  return {
    quoteAmount: input.catalogueTotal,
    unverifiedClientEstimate: input.catalogueTotal == null ? clientEstimate : null,
  };
}
