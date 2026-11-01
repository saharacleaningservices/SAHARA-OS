/**
 * Single source of truth for phone normalisation. Every module that matches a
 * customer by mobile number (leads, WhatsApp webhook, missed-call hook, public
 * booking, audiences) must go through these helpers so the same person never
 * ends up as two records.
 */

/** Digits only, last 10 (Indian mobile without country code). Never null. */
export function last10(raw?: string | null): string {
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

/** Last 10 digits only when they form a valid Indian mobile (6-9 prefix); else null. */
export function validMobile10(raw?: string | null): string | null {
  const d = last10(raw);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
