// Instant confirmation of website bookings (public-auto-confirm.ts, owner decision 30 Oct 2026) - integration test.
// Based on the publicBookLead characterisation harness (2026-10-22) — they pin down what the public booking action does TODAY,
// so it can be moved into a REST endpoint (docs/website/public-api-v1.openapi.yaml) without changing behaviour.
// Run: npm run test:publicbooking
//
// Safe by construction: a fresh throwaway SQLite DB (scripts/db-setup.mjs) — never dev.db or production; the
// WhatsApp / Google Sheet env vars are removed so nothing leaves this process; mobiles are fake (90000000xx).
// Next's request-only APIs (next/cache, next/headers) are stubbed.
//
// NOT covered yet (known gaps): slot-full rejection, the quotation-link path (bookFromQuotation), the WhatsApp
// template branch (WHATSAPP_USE_TEMPLATES=on), upsell events, booking-link close-out, festival-window pricing
// (depends on today's date).
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ---- environment: isolated DB, no outbound channels --------------------------------------------------------------
const dir = mkdtempSync(path.join(tmpdir(), "sahara-autoconfirm-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_USE_TEMPLATES", "WHATSAPP_OUTBOUND_MODE", "LEADS_SHEET_WEBHOOK_URL", "LEADS_SHEET_WEBHOOK_SECRET"]) delete process.env[k];
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

// ---- stubs for request-scoped Next APIs ---------------------------------------------------------------------------
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
const revalidated: string[] = [];
const reqHeaders: Headers | null = null; // null = outside a request (internal call): throttling is skipped
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: (p: string) => void revalidated.push(p), revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn };
  if (request === "next/headers") return { headers: async () => { if (!reqHeaders) throw new Error("outside request scope"); return reqHeaders; } };
  return realLoad.call(this, request, parent, isMain);
};

type Db = typeof import("../src/lib/db").db;
let db: Db;
let book: (v: unknown) => Promise<{ success?: true; leadNumber?: string; error?: string; status?: string; jobNumber?: string; bookingUrl?: string | null }>;

const ymdPlus = (days: number) => new Date(Date.now() + days * 86_400_000 + 5.5 * 3_600_000).toISOString().slice(0, 10);
let n = 0;
const mobile = () => `90000000${String(10 + n++).padStart(2, "0")}`; // 9000000010, 9000000011, … (fake)
const base = (over: Record<string, unknown> = {}) => ({ name: "Test Customer", mobile: mobile(), serviceCategory: "HOME_DEEP_CLEANING", ...over });

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  book = (await import("../src/server/actions/public-booking")).publicBookLead as typeof book;
  await db.user.create({ data: { name: "Test Admin", email: "admin@t", role: "ADMIN" as never, passwordHash: "x" } });
});
test.after(async () => {
  M._load = realLoad;
  await db.$disconnect(); // Windows keeps the SQLite file locked until the client is closed
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp dir; the OS cleans it up */ }
});

const SLOT = "10:00 AM – 12:00 PM";

test("pest control on an open window (from 6 Nov) is confirmed into a job with the booking confirmation queued", async () => {
  const date = ymdPlus(14) < "2026-11-06" ? "2026-11-09" : ymdPlus(14);
  const r = await book(base({ serviceCategory: "PEST_CONTROL", serviceVariant: "Termite", serviceDate: date, timeSlot: SLOT }));
  assert.equal(r.success, true, r.error);
  assert.equal(r.status, "CONFIRMED");
  assert.match(r.jobNumber ?? "", /\S/);
  const lead = await db.lead.findFirst({ where: { leadNumber: r.leadNumber } });
  assert.equal(lead?.stage, "JOB_SCHEDULED");
  const job = await db.job.findFirst({ where: { leadId: lead!.id } });
  assert.equal(job?.jobNumber, r.jobNumber);
  assert.equal(job?.scheduledTime, SLOT);
  assert.ok(job?.publicToken, "booking page token for the WhatsApp link");
  await new Promise((res) => setTimeout(res, 300)); // the confirmation is sent in the background
  const msg = await db.whatsAppMessage.findFirst({ where: { kind: "BOOKING_CONFIRMATION", relatedType: "Job", relatedId: job!.id } });
  assert.ok(msg, "booking confirmation queued for the job");
  const ack = await db.whatsAppMessage.findFirst({ where: { kind: "BOOKING_CONFIRMATION", relatedType: "Lead", relatedId: lead!.id } });
  assert.equal(ack, null, "no 'request received' acknowledgement when confirmed");
});

test("painting (custom quote) and dates before 6 Nov stay requests for the office", async () => {
  const late = ymdPlus(14) < "2026-11-06" ? "2026-11-10" : ymdPlus(15);
  const paint = await book(base({ serviceCategory: "PAINTING", serviceDate: late, timeSlot: SLOT }));
  assert.equal(paint.success, true, paint.error);
  assert.equal(paint.status, "PENDING");
  assert.equal(await db.job.count({ where: { lead: { leadNumber: paint.leadNumber } } }), 0);
  if (ymdPlus(1) < "2026-11-06") {
    const early = await book(base({ serviceCategory: "PEST_CONTROL", serviceDate: ymdPlus(1), timeSlot: SLOT }));
    assert.equal(early.status, "PENDING");
  }
});

test("Flexible time is never auto-confirmed", async () => {
  const r = await book(base({ serviceCategory: "INDIVIDUAL_CLEANING", serviceDate: "2026-11-12", timeSlot: "Flexible" }));
  assert.equal(r.status, "PENDING");
});
