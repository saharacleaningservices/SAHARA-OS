// Field Ops — pure rules for the Staff App job flow (2026-11-13): live GPS check-in, customer start OTP and the completion gate.
// No database, no network: everything here is unit-tested (tests/field-ops.test.ts).
import { randomInt, timingSafeEqual } from "node:crypto";

/** A GPS fix whose accuracy circle is wider than this is rejected: the staff member must step outside / retry. */
export const MAX_GPS_ACCURACY_M = 150;
/** Further than this from the pinned site → the office sees an [OUT-OF-ZONE GPS] badge. */
export const OUT_OF_ZONE_M = 1500;
/** Wrong start-OTP entries allowed before the office has to hand over the code. */
export const MAX_OTP_ATTEMPTS = 5;
/** Minimum live after-service photos before a job can be completed. */
export const MIN_AFTER_PHOTOS = 1;

export type RawFix = { lat?: unknown; lng?: unknown; acc?: unknown };
export type CleanFix = { lat: number; lng: number; acc: number };

// Pune/India bounding box: anything outside is a spoofed or broken fix for this business.
const INDIA = { latMin: 6, latMax: 37.5, lngMin: 68, lngMax: 98 };

/** Validates a browser geolocation reading. Returns the clean fix or a reason the staff member can act on. */
export function validateFix(v: unknown): { ok: true; fix: CleanFix } | { ok: false; error: string } {
  if (!v || typeof v !== "object") return { ok: false, error: "Location not received. Turn on GPS / Location and try again." };
  const { lat, lng, acc } = v as RawFix;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: "Invalid location. Turn on GPS and try again." };
  if (typeof acc !== "number" || !Number.isFinite(acc) || acc < 0) return { ok: false, error: "GPS accuracy missing. Turn on high-accuracy location and try again." };
  // Exactly 0,0 or a zero-accuracy reading is what mock-location apps send.
  if ((lat === 0 && lng === 0) || acc === 0) return { ok: false, error: "Location looks fake or unavailable. Turn off mock-location apps and try again." };
  if (lat < INDIA.latMin || lat > INDIA.latMax || lng < INDIA.lngMin || lng > INDIA.lngMax) return { ok: false, error: "Location is outside India. Please check your GPS." };
  if (acc > MAX_GPS_ACCURACY_M) return { ok: false, error: `GPS is not accurate enough (±${Math.round(acc)} m). Step outside or wait a few seconds and tap again (needs ±${MAX_GPS_ACCURACY_M} m or better).` };
  return { ok: true, fix: { lat, lng, acc: Math.round(acc) } };
}

/** Pulls "lat,lng" out of a Google Maps style link (…?q=18.55,73.94, …/@18.55,73.94,17z, …destination=…). Null when the job has no pin. */
export function coordsFromMapLink(link: string | null | undefined): { lat: number; lng: number } | null {
  if (!link) return null;
  const m = link.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Great-circle distance in metres. */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

export type GpsFlag = "OUT_OF_ZONE" | "NO_PIN" | null;

/** Compares the fix to the pinned site. No pin → NO_PIN (cannot be verified, the office is told); > 1.5 km → OUT_OF_ZONE. */
export function assessCheckIn(fix: CleanFix, mapLink: string | null | undefined): { distanceM: number | null; flag: GpsFlag } {
  const pin = coordsFromMapLink(mapLink);
  if (!pin) return { distanceM: null, flag: "NO_PIN" };
  const distanceM = distanceMetres(fix, pin);
  return { distanceM, flag: distanceM > OUT_OF_ZONE_M ? "OUT_OF_ZONE" : null };
}

/** Cryptographically random 4-digit code, 1000–9999 (never a leading zero, so it is never mistyped as 3 digits). */
export function generateStartOtp(): string {
  return String(randomInt(1000, 10000));
}

/** Constant-time compare of the entered code with the stored one. */
export function otpMatches(entered: unknown, stored: string | null | undefined): boolean {
  if (typeof entered !== "string" || !stored || !/^\d{4}$/.test(entered)) return false;
  const a = Buffer.from(entered);
  const b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const COLLECT_MODES = ["UPI", "CASH", "BANK", "PENDING_APPROVAL"] as const;
export type CollectMode = (typeof COLLECT_MODES)[number];
export const COLLECT_MODE_LABELS: Record<CollectMode, string> = {
  UPI: "UPI / QR",
  CASH: "Cash",
  BANK: "Company Bank Transfer",
  PENDING_APPROVAL: "Pending Approval",
};

/** Payment.mode values used elsewhere in the CRM (UPI | QR | BANK | CASH). */
export const paymentModeFor = (m: Exclude<CollectMode, "PENDING_APPROVAL">): string => m;

export type CompletionInput = { amount: unknown; mode: unknown; note?: unknown; afterPhotos: number; otpVerified: boolean; needsOtp: boolean };
export type CompletionResult =
  | { ok: true; amount: number; mode: CollectMode; note: string | null }
  | { ok: false; error: string };

/**
 * The completion gate. A job can be completed only with: the start OTP verified (when one was issued), at least MIN_AFTER_PHOTOS live
 * after-service photos, an exact amount (₹0 only when the payment is Pending Approval) and a payment mode. Pending Approval needs a reason.
 */
export function checkCompletion(i: CompletionInput): CompletionResult {
  if (i.needsOtp && !i.otpVerified) return { ok: false, error: "Start OTP was not verified for this job." };
  if (i.afterPhotos < MIN_AFTER_PHOTOS) return { ok: false, error: `Add at least ${MIN_AFTER_PHOTOS} after-service photo before completing.` };
  const mode = i.mode as CollectMode;
  if (!COLLECT_MODES.includes(mode)) return { ok: false, error: "Choose how the payment was collected." };
  const note = typeof i.note === "string" ? i.note.trim().slice(0, 300) : "";
  const amount = typeof i.amount === "number" ? i.amount : Number(i.amount);
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return { ok: false, error: "Enter the exact amount collected in ₹." };
  if (mode === "PENDING_APPROVAL") {
    if (note.length < 5) return { ok: false, error: "Pending Approval needs a reason (at least 5 characters)." };
    return { ok: true, amount: Math.round(amount * 100) / 100, mode, note };
  }
  if (amount <= 0) return { ok: false, error: "Enter the exact amount collected (more than ₹0), or choose Pending Approval with a reason." };
  return { ok: true, amount: Math.round(amount * 100) / 100, mode, note: note || null };
}

export type FieldStage = "ASSIGNED" | "REACHED" | "IN_PROGRESS" | "COMPLETED";

/** Live Field Ops stage for the office view: Assigned → Reached (GPS Verified) → In Progress (OTP Verified) → Completed (₹ Collected). */
export function fieldStage(j: { status: string; reachedAt: Date | null; startOtpVerifiedAt: Date | null }): FieldStage {
  if (j.status === "COMPLETED") return "COMPLETED";
  if (j.status === "STARTED" || j.startOtpVerifiedAt) return "IN_PROGRESS";
  if (j.reachedAt) return "REACHED";
  return "ASSIGNED";
}

export const FIELD_STAGE_LABELS: Record<FieldStage, string> = {
  ASSIGNED: "Assigned",
  REACHED: "Reached (GPS Verified)",
  IN_PROGRESS: "In Progress (OTP Verified)",
  COMPLETED: "Completed",
};

/** Customer WhatsApp text for the start OTP (plain message; reliable delivery needs an approved template — see the report). */
export function startOtpMessage(customerName: string, otp: string): string {
  return `Hi ${customerName}, our Sahara Cleaning Services team has reached your location.\n\nYour service start code is *${otp}*. Please share it with the team member only when you are ready for the work to begin.\n\nDo not share this code with anyone else. Help: 7083347130 / 8956567130.`;
}
