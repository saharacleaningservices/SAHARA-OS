/**
 * Single source of truth for phone normalisation. Every module that matches a
 * customer by mobile number (leads, WhatsApp webhook, missed-call hook, public
 * booking, audiences) must go through these helpers so the same person never
 * ends up as two records.
 *
 * Storage key (owner 2026-11-04 — "phone is the primary key"):
 *   • Indian numbers  → 10 digits, e.g. "9876543210" (unchanged — every existing
 *     record and lookup keeps working).
 *   • International   → full digits incl. country code, e.g. "61401180112".
 *     Before this fix "+61 401 180 112" was cut to "1401180112" (wrong person,
 *     undeliverable on WhatsApp).
 * Display / export uses toE164(): "+919876543210" / "+61401180112".
 */

export type NormalizedPhone = {
  /** Value stored in Customer.mobile and used for matching. */
  key: string;
  /** "+<country><number>" — for display, CSV export, WhatsApp. */
  e164: string;
  international: boolean;
};

/** Indian mobile / landline forms → the 10 national digits; null when not Indian-shaped. */
function indian10(d: string): string | null {
  if (d.length === 10) return d;
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 13 && d.startsWith("910")) return d.slice(3);
  return null;
}

/**
 * Parses any typed / imported / webhook number. Returns null for input that is
 * not a phone number at all (fewer than 8 digits, or more than 15 that are not
 * two numbers pasted together).
 */
export function normalizePhone(raw?: string | null): NormalizedPhone | null {
  const s = (raw ?? "").trim();
  let d = s.replace(/\D/g, "");
  if (s.startsWith("00") || (s.startsWith("+") && d.startsWith("00"))) d = d.replace(/^00/, "");
  if (!d) return null;
  const plusIndian = s.startsWith("+") && d.startsWith("91") && d.length === 12;
  const ind = plusIndian ? d.slice(2) : s.startsWith("+") && !d.startsWith("91") ? null : indian10(d);
  if (ind) return { key: ind, e164: `+91${ind}`, international: false };
  if (d.length >= 8 && d.length <= 15 && !d.startsWith("0")) return { key: d, e164: `+${d}`, international: true };
  // Legacy behaviour for junk / concatenated numbers: last 10 digits.
  if (d.length > 15) {
    const t = d.slice(-10);
    return { key: t, e164: `+91${t}`, international: false };
  }
  return null;
}

/**
 * Matching key for a number — 10 digits for Indian numbers, full digits for
 * international ones. Kept under its historical name so every existing call
 * site gets the international fix without being touched. Never null.
 */
export function last10(raw?: string | null): string {
  const n = normalizePhone(raw);
  if (n) return n.key;
  return (raw ?? "").replace(/\D/g, "").slice(-10);
}

/** Last 10 digits only when they form a valid Indian mobile (6-9 prefix); else null. */
export function validMobile10(raw?: string | null): string | null {
  const d = last10(raw);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** A valid storage key: Indian mobile (6-9, 10 digits) or an international number (8–15 digits). */
export function validPhoneKey(raw?: string | null): string | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  if (n.international) return n.key;
  return /^[6-9]\d{9}$/.test(n.key) ? n.key : null;
}

/** "+91XXXXXXXXXX" for Indian numbers, "+<digits>" for international; "" when unparseable. */
export function toE164(raw?: string | null): string {
  return normalizePhone(raw)?.e164 ?? "";
}

/** True for a stored 10-digit key that cannot be an Indian number — usually an international number truncated before the 2026-11-04 fix. */
export function looksTruncatedInternational(stored?: string | null): boolean {
  return /^[0-5]\d{9}$/.test((stored ?? "").trim());
}
