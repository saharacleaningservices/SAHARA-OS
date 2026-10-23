// Lead / booking page cleanup (owner brief 2026-10-24, item 2): one contextual primary action, Overview under the header, tidy timeline,
// streamlined status flow, Reschedule Date/Time. Run: npx tsx --test tests/lead-page-cleanup.test.ts   Synthetic data; throwaway DB.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { primaryLeadAction, PRIMARY_ACTION_LABEL } from "../src/lib/lead-primary-action";
import { tidyTimeline } from "../src/lib/timeline-tidy";
import { LEAD_STAGE_FLOW, LEAD_STAGE_LABELS } from "../src/lib/constants";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-lp-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

type Session = { sub: string; name: string; email: string; role: string };
let session: Session | null = null;
type Loader = (this: unknown, request: string, parent: unknown, isMain: boolean) => unknown;
const M = Module as unknown as { _load: Loader };
const realLoad = M._load;
M._load = function (this: unknown, request, parent, isMain) {
  if (request === "next/cache") return { revalidatePath: () => {}, revalidateTag: () => {} };
  if (request === "@/lib/session") {
    const real = realLoad.call(this, request, parent, isMain) as Record<string, unknown>;
    return { ...real, getSession: async () => session };
  }
  return realLoad.call(this, request, parent, isMain);
};
let db: typeof import("../src/lib/db").db;
let act: typeof import("../src/server/actions/leads");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  act = await import("../src/server/actions/leads");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("primary action follows the status: quote -> confirm -> reschedule -> convert / share; nothing once cancelled", () => {
  const base = { hasJob: false, hasQuotation: false, hasInvoice: false, canQuote: true };
  assert.equal(primaryLeadAction({ ...base, stage: "NEW" }), "CREATE_QUOTATION");
  assert.equal(primaryLeadAction({ ...base, stage: "NEW", hasQuotation: true }), "CONFIRM_BOOKING");
  assert.equal(primaryLeadAction({ ...base, stage: "QUOTATION", hasQuotation: true }), "CONFIRM_BOOKING");
  assert.equal(primaryLeadAction({ ...base, stage: "CONFIRMED" }), "CONFIRM_BOOKING");
  assert.equal(primaryLeadAction({ ...base, stage: "NEW", canQuote: false }), "CONFIRM_BOOKING", "a role that cannot quote goes straight to confirming");
  assert.equal(primaryLeadAction({ ...base, stage: "JOB_SCHEDULED", hasJob: true, jobStatus: "ASSIGNED" }), "RESCHEDULE_JOB");
  assert.equal(primaryLeadAction({ ...base, stage: "JOB_SCHEDULED", hasJob: true, jobStatus: "STARTED" }), "RESCHEDULE_JOB");
  assert.equal(primaryLeadAction({ ...base, stage: "COMPLETED", hasJob: true, jobStatus: "COMPLETED" }), "CONVERT_TO_INVOICE");
  assert.equal(primaryLeadAction({ ...base, stage: "COMPLETED", hasJob: true, jobStatus: "COMPLETED", hasInvoice: true }), "SHARE_PDF");
  assert.equal(primaryLeadAction({ ...base, stage: "COMPLETED", hasJob: true, jobStatus: "COMPLETED", hasInvoice: true, canQuote: false }), "NONE", "no money documents for roles that cannot see money");
  assert.equal(primaryLeadAction({ ...base, stage: "CANCELLED" }), "NONE");
  assert.equal(primaryLeadAction({ ...base, stage: "JOB_SCHEDULED", hasJob: true, jobStatus: "CANCELLED" }), "NONE");
  assert.deepEqual(Object.values(PRIMARY_ACTION_LABEL).filter(Boolean), ["Create Quotation", "Confirm Booking", "Reschedule Job", "Share PDF", "Convert to Invoice"]);
});

test("status flow wording: New Inquiry -> Quotation Sent -> Confirmed -> Pending Job -> Completed / Cancelled; old stages still render", () => {
  assert.deepEqual(LEAD_STAGE_FLOW.map((s) => LEAD_STAGE_LABELS[s]), ["New Inquiry", "Quotation Sent", "Confirmed", "Pending Job", "Completed", "Cancelled"]);
  assert.equal(LEAD_STAGE_LABELS.INTERESTED, "Interested");
  assert.equal(LEAD_STAGE_LABELS.SITE_VISIT, "Site Visit");
});

test("timeline: placeholder notes and repeated system lines disappear; real notes, voice memos and call logs are untouched", () => {
  const t = (id: string, type: string, body: string | null, ms: number, audioUrl: string | null = null) => ({ id, type, body, audioUrl, createdAt: new Date(1_700_000_000_000 + ms) });
  const out = tidyTimeline([
    t("1", "NOTE", "Customer wants Sunday", 0),
    t("2", "NOTE", "Type more", 1000),
    t("3", "NOTE", "  ", 2000),
    t("4", "STAGE", "Stage → Quotation Sent", 3000),
    t("5", "STAGE", "Stage → Quotation Sent", 4000), // double click
    t("6", "STAGE", "Stage → Quotation Sent", 600_000), // genuinely later
    t("7", "VOICE", null, 5000, "/uploads/x.webm"),
    t("8", "CALL", "Called, no answer", 6000),
    t("9", "NOTE", "Customer wants Sunday", 7000), // same words, but a note: kept
  ]);
  assert.deepEqual(out.map((e) => e.id), ["1", "4", "6", "7", "8", "9"]);
});

test("Reschedule Date/Time on an enquiry without a job: updates date + slot, writes a timeline line, respects role and state", async () => {
  const admin = await db.user.create({ data: { name: "Altaf", email: "a@t.test", passwordHash: "x", role: "ADMIN" } });
  const lead = await db.lead.create({ data: { leadNumber: "L-LP1", name: "Asha", mobile: "9811111111", area: "Baner", service: "HOME_DEEP_CLEANING", source: "CALL", stage: "QUOTATION" } as never });
  session = { sub: "s", name: "Crew", email: "s@x", role: "STAFF" };
  assert.equal((await act.rescheduleLead(lead.id, "2026-11-05", "10:00 AM")).success, false, "field staff cannot");
  session = { sub: admin.id, name: "Altaf", email: "a@t.test", role: "ADMIN" };
  assert.equal((await act.rescheduleLead(lead.id, "05/11/2026", "10:00 AM")).success, false, "bad date");
  assert.equal((await act.rescheduleLead(lead.id, "2026-11-05", " ")).success, false, "no slot");
  const ok = await act.rescheduleLead(lead.id, "2026-11-05", "10:00 AM - 1:00 PM");
  assert.equal(ok.success, true, JSON.stringify(ok));
  const after = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
  assert.deepEqual([after.serviceDate?.toISOString().slice(0, 10), after.timeSlot], ["2026-11-05", "10:00 AM - 1:00 PM"]);
  const line = await db.timelineEntry.findFirstOrThrow({ where: { leadId: lead.id, type: "SYSTEM" } });
  assert.match(String(line.body), /Requested date\/time/);
  await db.job.create({ data: { jobNumber: "LP-J1", leadId: lead.id, customerName: "Asha", customerMobile: "9811111111", address: "a", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 1, status: "ASSIGNED" } as never });
  assert.match(String((await act.rescheduleLead(lead.id, "2026-11-06", "2:00 PM") as { error?: string }).error), /reschedule the job/i, "a booked enquiry is rescheduled through its job");
  await db.lead.update({ where: { id: lead.id }, data: { stage: "CANCELLED" } });
  await db.job.deleteMany({ where: { leadId: lead.id } });
  assert.equal((await act.rescheduleLead(lead.id, "2026-11-06", "2:00 PM")).success, false, "not for a cancelled enquiry");
});

test("page: the four old header buttons are gone, Overview sits first under the header, the old card is now Details", () => {
  const page = readFileSync("src/app/(app)/leads/[id]/page.tsx", "utf8");
  for (const gone of ["SendBookingFormButton", "SendPaymentLinkButton", "ScheduleVisitDialog", 'kind="REVIEW"']) assert.ok(!page.includes(gone), `${gone} left the page`);
  assert.ok(page.indexOf("<CardTitle>Overview</CardTitle>") < page.indexOf("<BookedScopeCard"), "Overview first");
  assert.ok(page.includes("<CardTitle>Details</CardTitle>"));
  for (const need of ["Requested Date / Time", "Assigned Team", "Address", "Mobile", "RescheduleDialog"]) assert.ok(page.includes(need), need);
  const header = page.slice(page.indexOf("actions={"), page.indexOf("<div className=\"grid grid-cols-1 gap-4 lg:grid-cols-3\">"));
  assert.equal((header.match(/trigger=\{<Button size="sm">|primary\b|<SharePdfButton|<GenerateInvoiceButton/g) ?? []).length >= 4, true, "the primary action variants live in the header");
});
