// Public (unauthenticated) booking requests can never prove a payment or set an
// authoritative price. These pure helpers keep that rule in one testable place.
// There is no payment gateway: anything the customer "declares" stays pending
// verification until staff record it in the CRM (authenticated actions only).

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
