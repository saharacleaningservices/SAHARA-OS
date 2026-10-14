// Input guards for the owner's Quick Add Inquiry (pure functions — no database).

const MOBILE_NOISE = /[\s\-().]/g;

export type MobileResult = { ok: true; mobile: string } | { ok: false; error: string };

/**
 * Indian mobile number from whatever was pasted: "+91 98765 43210", "098765-43210", "919876543210",
 * "98765 43210". Returns the 10-digit national number (starts 6–9) or an error. Letters and other
 * stray characters are rejected rather than silently stripped.
 */
export function parseIndianMobile(raw: unknown): MobileResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "Enter the customer's mobile number" };
  const cleaned = raw.trim().replace(MOBILE_NOISE, "");
  if (!/^\+?\d+$/.test(cleaned)) return { ok: false, error: "Mobile number can contain digits only (and a leading +91)" };
  let d = cleaned.replace(/^\+/, "");
  if (d.length === 13 && d.startsWith("091")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length !== 10) return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };
  if (!/^[6-9]/.test(d)) return { ok: false, error: "Indian mobile numbers start with 6, 7, 8 or 9" };
  return { ok: true, mobile: d };
}

export const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Masked form for lists / logs: ••••••3210. */
export const maskMobile = (m: string) => `••••••${m.slice(-4)}`;
