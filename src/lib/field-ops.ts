// Field Ops — pure rules for the Staff App job flow (2026-11-13): live GPS check-in, customer start OTP and the completion gate.
// No database, no network: everything here is unit-tested (tests/field-ops.test.ts).
import { randomInt, timingSafeEqual } from "node:crypto";

/** A GPS fix whose accuracy circle is wider than this is rejected: the staff member must step outside / retry. */
export const MAX_GPS_ACCURACY_M = 150;
/** Further than this from the pinned site → the office sees an [OUT-OF-ZONE GPS] badge. */
export const OUT_OF_ZONE_M = 1500;
/** Wrong start-OTP entries allowed before the office has to hand over the code. */
export const MAX_OTP_ATTEMPTS = 5;

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

export const COLLECT_MODES = ["UPI", "CASH", "BANK", "PENDING_APPROVAL", "CREDIT_OVERRIDE"] as const;
export type CollectMode = (typeof COLLECT_MODES)[number];
export const COLLECT_MODE_LABELS: Record<CollectMode, string> = {
  UPI: "UPI / QR",
  CASH: "Cash",
  BANK: "Company Bank Transfer",
  PENDING_APPROVAL: "Pending Approval",
  CREDIT_OVERRIDE: "Corporate / Credit Override",
};

/** Payment-gate rule (owner 2026-11-14): technicians close a job with UPI/QR Paid or Cash Paid only; the office may also record a bank transfer; only an Admin may use Corporate / Credit Override. */
export type CompletionActor = "STAFF" | "OFFICE" | "ADMIN";
export const STAFF_COLLECT_MODES: readonly CollectMode[] = ["UPI", "CASH"];
export const OFFICE_COLLECT_MODES: readonly CollectMode[] = ["UPI", "CASH", "BANK"];

/** What the Payment row / activity log records for each way of closing a job. `at` stamps cash with the collection time (IST). */
export function paymentRecordLabel(mode: CollectMode, staffName: string, at: Date = new Date()): string {
  const ist = at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
  switch (mode) {
    case "UPI": return "Paid (UPI - Screenshot Shared)";
    case "CASH": return `Paid (Cash - Collected by ${staffName}) · Cash Collected by ${staffName}, ${ist} IST`;
    case "BANK": return "Paid (Company Bank Transfer)";
    case "CREDIT_OVERRIDE": return `Credit (Corporate / Credit Override by ${staffName})`;
    default: return "Pending Approval";
  }
}

export const UPI_PROOF_CONFIRMATION = "Customer paid via UPI QR & payment screenshot shared in Sahara Cleaning Services WhatsApp Group";

/** Payment.mode values used elsewhere in the CRM (UPI | QR | BANK | CASH). */
export const paymentModeFor = (m: Exclude<CollectMode, "PENDING_APPROVAL">): string => m;

export type CompletionInput = { amount: unknown; mode: unknown; note?: unknown; otpVerified: boolean; needsOtp: boolean; /** Who is closing. Omitted = legacy permissive rules. */ actor?: CompletionActor; /** Technician ticked the UPI proof confirmation. */ upiConfirmed?: boolean };
export type CompletionResult =
  | { ok: true; amount: number; mode: CollectMode; note: string | null }
  | { ok: false; error: string };

/**
 * The completion gate (2026-11-13: payment only — no photo upload). A job can be completed only with: the start OTP verified (when one was
 * issued), an exact amount (₹0 only when the payment is Pending Approval) and a payment mode. Pending Approval needs a reason.
 */
export function checkCompletion(i: CompletionInput): CompletionResult {
  if (i.needsOtp && !i.otpVerified) return { ok: false, error: "Start OTP was not verified for this job." };
  const mode = i.mode as CollectMode;
  if (!COLLECT_MODES.includes(mode)) return { ok: false, error: "Choose how the payment was collected." };
  const note = typeof i.note === "string" ? i.note.trim().slice(0, 300) : "";
  if (i.actor === "STAFF" && !STAFF_COLLECT_MODES.includes(mode)) return { ok: false, error: "Choose UPI / QR Paid or Cash Paid before closing the job." };
  if (i.actor === "OFFICE" && !OFFICE_COLLECT_MODES.includes(mode)) return { ok: false, error: "Choose UPI, Cash or Bank transfer before closing the job." };
  if (mode === "CREDIT_OVERRIDE") {
    if (i.actor !== "ADMIN") return { ok: false, error: "Only an Admin can close a job with Corporate / Credit Override." };
    if (note.length < 5) return { ok: false, error: "Corporate / Credit Override needs a reason (at least 5 characters)." };
    return { ok: true, amount: 0, mode, note };
  }
  if (mode === "UPI" && i.actor === "STAFF" && i.upiConfirmed !== true) return { ok: false, error: "Tick the confirmation: customer paid via UPI QR and the payment screenshot was shared in the Sahara Cleaning Services WhatsApp Group." };
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

/** Bill split shown on the close screen: Total Bill, Advance Paid (sum of payments already received) and the Balance Payable. */
export function billSummary(total: number, payments: { paidAmount: number }[]): { total: number; advance: number; balance: number } {
  const t = Math.max(0, Number.isFinite(total) ? total : 0);
  const paid = payments.reduce((n, p) => n + (Number.isFinite(p.paidAmount) ? Math.max(0, p.paidAmount) : 0), 0);
  const advance = Math.min(Math.round(paid * 100) / 100, t);
  return { total: t, advance, balance: Math.round((t - advance) * 100) / 100 };
}

// ── Who may see whose GPS (owner brief 2026-11-13, tightened 2026-11-14) ───────────────────────────────────────────────────────────
// SUPERVISOR here means "office / management subject": Super Admin, Operations, Accounts, Supervisor logins and office designations.
// The value is frozen on every LocationPing row, so it keeps its historical name.
export type GpsSubject = "FIELD" | "SUPERVISOR";
/** Login roles whose own location is never shown to anyone but the Super Admin (ADMIN included: Altaf is never on Shoaib's map). */
const OFFICE_SUBJECT_ROLES = ["ADMIN", "OPERATIONS", "ACCOUNTS", "SUPERVISOR"];
/** Office designations for staff records without an office login (Francis / Shoaib type profiles, owner, accounts, office staff). */
const OFFICE_DESIGNATION = /supervisor|manager|coordinator|owner|director|admin|accountant|\baccounts?\b|office/i;

/** Office / management people are SUPERVISOR subjects: by their login role, or — when they have no office login — by designation. */
export function gpsSubjectOf(s: { designation?: string | null; userRole?: string | null }): GpsSubject {
  if (s.userRole && OFFICE_SUBJECT_ROLES.includes(s.userRole)) return "SUPERVISOR";
  if (s.designation && OFFICE_DESIGNATION.test(s.designation)) return "SUPERVISOR";
  return "FIELD";
}

/**
 * Who gets a staff-location map (owner 2026-11-14):
 *  - Super Admin (role ADMIN — Altaf): every staff member, office people included → "ALL".
 *  - Shoaib → "ACTIVE_FIELD": only field technicians / staff who are on an active job (On the way / In progress) or checked in for
 *    today's shift — never the Super Admin, never office roles (ADMIN / OPERATIONS / ACCOUNTS / SUPERVISOR) or office designations.
 *    Shoaib is identified by his login role ACCOUNTS: scripts/db-setup.mjs re-applies accounts@saharacleaningservices.com
 *    (Shoyab / Shoaib Kazi) → ACCOUNTS on every boot, and no other production login holds ACCOUNTS.
 *  - Everyone else (Francis / OPERATIONS, SUPERVISOR logins, STAFF): no map → null.
 */
export const GPS_FIELD_MAP_ROLES: readonly string[] = ["ACCOUNTS"];
export type GpsMapScope = "ALL" | "ACTIVE_FIELD";
export function gpsMapScope(role: string | null | undefined): GpsMapScope | null {
  if (role === "ADMIN") return "ALL";
  if (role && GPS_FIELD_MAP_ROLES.includes(role)) return "ACTIVE_FIELD";
  return null;
}

/**
 * The single per-person rule behind every location read (live map, /field-ops check-in pins). `active` = the subject is on an active
 * job or checked in for the shift; omit it when the row itself is already scoped to a live job.
 */
export function canViewGps(viewer: { role: string; staffId?: string | null }, subject: { staffId?: string | null; type: GpsSubject; active?: boolean }): boolean {
  const scope = gpsMapScope(viewer.role);
  if (scope === "ALL") return true;
  if (scope !== "ACTIVE_FIELD") return false;
  if (subject.type !== "FIELD") return false;
  if (subject.active === false) return false;
  if (viewer.staffId && subject.staffId && viewer.staffId === subject.staffId) return false;
  return true;
}

/**
 * Prisma `where` for the LocationPing rows a viewer may read since `since` — enforced in the query, not only in the UI. Null = no access.
 * ACTIVE_FIELD is limited to rows frozen as FIELD and to the ids of staff who are active right now (office logins without a Staff
 * profile are logged as "user:<id>" and can never be in that list).
 */
export function locationPingWhere(scope: GpsMapScope | null, activeFieldStaffIds: readonly string[], since: Date) {
  if (scope === "ALL") return { createdAt: { gte: since } };
  if (scope === "ACTIVE_FIELD") return { createdAt: { gte: since }, subjectType: "FIELD", staffId: { in: activeFieldStaffIds.filter((id) => !id.startsWith("user:")) } };
  return null;
}

export type LivePingRow = { staffId: string; staffName: string; jobId: string | null; kind: string; lat: number; lng: number; accuracyM: number | null; subjectType: string; createdAt: Date };
export type LiveLocation = LivePingRow & { type: GpsSubject; active: boolean; pings: number };

/**
 * Newest ping per person, filtered through canViewGps. `current` re-derives each person's subject type from their CURRENT staff record
 * (role / designation) — a ping frozen as FIELD is still hidden from Shoaib if that person has since become office staff.
 */
export function latestVisibleLocations(
  viewer: { role: string; staffId?: string | null },
  rows: readonly LivePingRow[],
  current: ReadonlyMap<string, GpsSubject>,
  activeFieldStaffIds: ReadonlySet<string>,
): LiveLocation[] {
  const byPerson = new Map<string, LiveLocation>();
  for (const r of [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const seen = byPerson.get(r.staffId);
    if (seen) { seen.pings += 1; continue; }
    const type: GpsSubject = r.subjectType === "SUPERVISOR" || current.get(r.staffId) === "SUPERVISOR" || r.staffId.startsWith("user:") ? "SUPERVISOR" : "FIELD";
    const active = activeFieldStaffIds.has(r.staffId);
    if (!canViewGps(viewer, { staffId: r.staffId, type, active })) continue;
    byPerson.set(r.staffId, { ...r, type, active, pings: 1 });
  }
  return [...byPerson.values()];
}

// ── Continuous active-shift pings (2026-11-14) ─────────────────────────────────────────────────────────────────────────────────────
/** Client ping cadence; the server refuses anything closer than MIN_PING_GAP_MS for the same person. */
export const PING_EVERY_MS = 3 * 60_000;
export const MIN_PING_GAP_MS = 2 * 60_000;
/** Job statuses during which a technician's phone keeps pinging (On the way → Reached → In progress, until Completed). */
export const LIVE_JOB_STATUSES = ["ON_THE_WAY", "STARTED"] as const;

/** Checked in for today's shift (IST) and not yet checked out. */
export function isOnShift(a: { checkInTime: Date | null; checkOutTime: Date | null } | null | undefined, dayStart: Date): boolean {
  return !!a?.checkInTime && a.checkInTime.getTime() >= dayStart.getTime() && !a.checkOutTime;
}

/**
 * Should this ping be stored, and against which job? Office supervisors always (jobId null unless given). A technician pings while
 * holding a live job (the requested one if it is theirs and live, else their own live job) or while checked in for the shift (no job).
 */
export function resolvePingTarget(i: { office: boolean; requestedJobId: string | null; requestedJobLive: boolean; ownLiveJobId: string | null; onShift: boolean }):
  | { ok: true; jobId: string | null }
  | { ok: false; reason: "no-active-job" } {
  if (i.office) return { ok: true, jobId: i.requestedJobId && i.requestedJobLive ? i.requestedJobId : null };
  if (i.requestedJobId && i.requestedJobLive) return { ok: true, jobId: i.requestedJobId };
  if (i.ownLiveJobId) return { ok: true, jobId: i.ownLiveJobId };
  if (i.onShift) return { ok: true, jobId: null };
  return { ok: false, reason: "no-active-job" };
}

/** Only the Super Admin manages tracking (switch on/off, settings). */
export const canManageTracking = (role: string | null | undefined): boolean => role === "ADMIN";

/** Roles that may verify a payment and close a job from /field-ops: Altaf (ADMIN), Francis (OPERATIONS), Shoaib (ACCOUNTS). */
export const canOfficeClose = (role: string | null | undefined): boolean => role === "ADMIN" || role === "OPERATIONS" || role === "ACCOUNTS";

/** The bold office alert for cash that is still in a staff member's pocket. */
export const cashWithStaffLabel = (name: string, amount: number): string => `[CASH WITH STAFF: ${name} — ₹${amount.toLocaleString("en-IN")}]`;

/**
 * Payload for the Meta Utility template `sahara_start_otp_v1` (body: {{1}} customer name, {{2}} code). Used only when the owner sets
 * WHATSAPP_START_OTP_TEMPLATE=v1 after Meta approves it; until then the plain-text message (startOtpMessage) is sent.
 */
export function startOtpTemplatePayload(customerName: string, otp: string) {
  const bodyParams = [customerName, otp];
  return {
    templateName: "sahara_start_otp_v1",
    languageCode: "en",
    bodyParams,
    preview: `Hi ${customerName}, your Sahara Cleaning Services start code is ${otp}. Share it with our team member only when you are ready for the work to begin.`,
  };
}
