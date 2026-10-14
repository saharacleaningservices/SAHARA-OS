// Owner direct-entry source, one-click staff outcomes and the owner tracker (2026-10-14). Run: npm run test:inquiry
// Fresh throwaway SQLite DB (scripts/db-setup.mjs) — never dev.db, no network, no WhatsApp/SMS.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkOutcome, parseNextFollowUp } from "../src/lib/inquiry-outcomes";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-outcome-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let inq: typeof import("../src/server/owner-inquiry");
type U = { id: string; name: string; email: string; role: string };
let admin: U;
let shoyab: U;
let francis: U;
const idsAll = () => [shoyab.id, francis.id];

test.before(async () => {
  db = (await import("../src/lib/db")).db;
  inq = await import("../src/server/owner-inquiry");
  const mk = (name: string, email: string, role: string) => db.user.create({ data: { name, email, role: role as never, passwordHash: "x" } }) as unknown as Promise<U>;
  admin = await mk("Altaf Shaikh", "altaf@t", "ADMIN");
  shoyab = await mk("Shoyab Kazi", "shoyab@t", "ACCOUNTS");
  francis = await mk("Francis", "francis@t", "OPERATIONS");
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("next follow-up parsing: IST datetime, bare date = 10:00 IST, past / far future / garbage rejected", () => {
  const now = Date.parse("2026-10-14T06:00:00Z");
  const a = parseNextFollowUp("2026-10-15T09:30", now);
  assert.ok(a.ok && a.at?.toISOString() === "2026-10-15T04:00:00.000Z");
  const b = parseNextFollowUp("2026-10-16", now);
  assert.ok(b.ok && b.at?.toISOString() === "2026-10-16T04:30:00.000Z");
  assert.deepEqual(parseNextFollowUp("", now), { ok: true, at: null });
  assert.equal(parseNextFollowUp("2026-10-13T09:00", now).ok, false);
  assert.equal(parseNextFollowUp("2026-12-30T09:00", now).ok, false);
  assert.equal(parseNextFollowUp("tomorrow", now).ok, false);
  assert.equal(parseNextFollowUp(12345 as never, now).ok, false);
});

test("outcomes are cross-checked: Quotation Sent / Booking Confirmed are CONFIRMED only when the CRM agrees", () => {
  assert.equal(checkOutcome("QUOTATION_SENT", { quotationCount: 0, stage: "NEW", jobCount: 0 }).state, "NOT_CONFIRMED");
  assert.equal(checkOutcome("QUOTATION_SENT", { quotationCount: 1, stage: "QUOTATION", jobCount: 0 }).state, "CONFIRMED");
  assert.equal(checkOutcome("BOOKING_CONFIRMED", { quotationCount: 0, stage: "QUOTATION", jobCount: 0 }).state, "NOT_CONFIRMED");
  assert.equal(checkOutcome("BOOKING_CONFIRMED", { quotationCount: 0, stage: "JOB_SCHEDULED", jobCount: 0 }).state, "CONFIRMED");
  assert.equal(checkOutcome("NO_ANSWER", { quotationCount: 0, stage: "NEW", jobCount: 0 }).state, "SELF_REPORTED");
});

test("direct entry keeps the real source (Truecaller / WhatsApp) and is attributed to Altaf", async () => {
  const r = await inq.createOwnerInquiry(admin as never, { mobile: "9820066666", source: "TRUECALLER", assigneeIds: idsAll() });
  assert.ok(r.ok && "leadId" in r);
  if (!r.ok || !("leadId" in r)) return;
  const l = (await db.lead.findUnique({ where: { id: r.leadId } }))!;
  assert.equal(l.acquisitionChannel, "Phone Call");
  assert.equal(l.createdById, admin.id);
  const t = (await db.timelineEntry.findFirst({ where: { leadId: l.id }, orderBy: { createdAt: "asc" } }))!;
  assert.match(t.body ?? "", /Direct CRM Entry/);
  assert.match(t.body ?? "", /Truecaller/);
  const w = await inq.createOwnerInquiry(admin as never, { mobile: "9820077777", source: "WHATSAPP", assigneeIds: idsAll() });
  assert.ok(w.ok && "leadId" in w);
  if (w.ok && "leadId" in w) {
    const wl = (await db.lead.findUnique({ where: { id: w.leadId } }))!;
    assert.equal(wl.source, "WHATSAPP");
    assert.equal(wl.acquisitionChannel, "WhatsApp Direct");
  }
  assert.ok((await inq.createOwnerInquiry(admin as never, { mobile: "9820088888", source: "BOGUS", assigneeIds: idsAll() })).ok, "unknown source falls back to phone call");
});

test("a lead is saved and alerts verified; no warning when every recipient got their notification", async () => {
  const r = await inq.createOwnerInquiry(admin as never, { mobile: "9820099999", assigneeIds: idsAll() });
  assert.ok(r.ok && "leadId" in r && r.alertWarning === undefined);
  assert.equal(await db.notification.count({ where: { kind: "OWNER_INQUIRY", meta: { contains: (r as { leadId: string }).leadId } } }), 2);
});

test("one-click outcome: who/what/when/note recorded, alert acknowledged, stage / quotation / booking / payment untouched", async () => {
  const lead = (await db.lead.findFirst({ where: { mobile: "9820066666" } }))!;
  const alert = (await inq.listInquiryAlerts({ id: shoyab.id, role: "ACCOUNTS" }, 50)).find((a) => a.leadId === lead.id)!;
  const before = { q: await db.quotation.count(), j: await db.job.count(), p: await db.payment.count() };
  const refused = await inq.recordInquiryOutcome(shoyab, { leadId: lead.id, outcome: "QUOTATION_SENT", nextFollowUp: "2099-01-01" });
  assert.equal(refused.ok, false, "a next follow-up too far ahead is refused and nothing is recorded");
  assert.equal(await db.timelineEntry.count({ where: { leadId: lead.id, meta: { contains: "INQUIRY_OUTCOME" } } }), 0);
  const ok = await inq.recordInquiryOutcome(shoyab, { leadId: lead.id, outcome: "QUOTATION_SENT", note: "Sent 3BHK estimate on call", nextFollowUp: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16), alertId: alert.id });
  assert.ok(ok.ok && !ok.already);
  const entry = (await db.timelineEntry.findFirst({ where: { leadId: lead.id, authorId: shoyab.id, meta: { contains: "INQUIRY_OUTCOME" } } }))!;
  assert.match(entry.body ?? "", /Shoyab Kazi: Quotation Sent — Sent 3BHK estimate on call \(next follow-up/);
  const meta = JSON.parse(entry.meta!);
  assert.equal(meta.outcome, "QUOTATION_SENT");
  assert.equal(meta.userId, shoyab.id);
  assert.equal(await db.auditLog.count({ where: { entityId: lead.id, action: "INQUIRY_OUTCOME_QUOTATION_SENT", actorName: "Shoyab Kazi" } }), 1);
  assert.equal(await db.followUp.count({ where: { leadId: lead.id, assignedToId: shoyab.id } }), 1, "the dated next follow-up is a normal CRM follow-up");
  assert.ok(!(await inq.listInquiryAlerts({ id: shoyab.id, role: "ACCOUNTS" }, 50)).some((a) => a.id === alert.id), "alert acknowledged by the outcome click");
  assert.equal((await db.lead.findUnique({ where: { id: lead.id } }))!.stage, "NEW");
  assert.deepEqual({ q: await db.quotation.count(), j: await db.job.count(), p: await db.payment.count() }, before);
  const again = await inq.recordInquiryOutcome(shoyab, { leadId: lead.id, outcome: "QUOTATION_SENT", note: "Sent 3BHK estimate on call" });
  assert.ok(again.ok && again.already, "a double click is a no-op");
  assert.equal(await db.timelineEntry.count({ where: { leadId: lead.id, authorId: shoyab.id, meta: { contains: "QUOTATION_SENT" } } }), 1);
});

test("outcome permissions: Operations only inside its lead scope; staff, unknown outcomes and missing leads refused", async () => {
  const lead = (await db.lead.findFirst({ where: { mobile: "9820066666" } }))!;
  assert.equal((await inq.recordInquiryOutcome({ id: "x", name: "Field Staff", email: "s@t", role: "STAFF" }, { leadId: lead.id, outcome: "CALLED" })).ok, false);
  assert.equal((await inq.recordInquiryOutcome(francis, { leadId: lead.id, outcome: "NOT_A_REAL_OUTCOME" })).ok, false);
  assert.equal((await inq.recordInquiryOutcome(francis, { leadId: "missing", outcome: "CALLED" })).ok, false);
  assert.ok((await inq.recordInquiryOutcome(francis, { leadId: lead.id, outcome: "NO_ANSWER", note: "Rang twice" })).ok);
  await db.lead.update({ where: { id: lead.id }, data: { stage: "QUOTATION" as never, assignedToId: shoyab.id } });
  assert.equal((await inq.recordInquiryOutcome(francis, { leadId: lead.id, outcome: "CALLED" })).ok, false, "outside Operations' scope once the lead moved on");
  assert.ok((await inq.recordInquiryOutcome(shoyab, { leadId: lead.id, outcome: "CALLED" })).ok);
});

test("owner tracker: recipients seen/pending, each outcome with who/when/note, honest verification states", async () => {
  const lead = (await db.lead.findFirst({ where: { mobile: "9820066666" } }))!;
  const find = async () => (await inq.getInquiryTracker(50)).find((r) => r.leadId === lead.id)!;
  let row = await find();
  assert.ok(row);
  assert.equal(row.source, "Phone Call");
  assert.deepEqual(row.recipients.map((r) => r.name).sort(), ["Francis", "Shoyab Kazi"]);
  assert.ok(row.recipients.every((r) => r.seenAt), "both alerts were acknowledged by their outcome clicks");
  assert.equal(row.outcomes.length, 3);
  assert.equal(row.outcomes[0].by, "Shoyab Kazi");
  assert.equal(row.outcomes.find((o) => o.outcome === "QUOTATION_SENT")!.check.state, "NOT_CONFIRMED", "no quotation exists in the CRM yet");
  await db.quotation.create({ data: { quoteNumber: "QT-T-OUT", leadId: lead.id, services: "[]", subTotal: 5000, totalAmount: 5000, terms: "x", status: "SENT" as never } });
  row = await find();
  assert.equal(row.outcomes.find((o) => o.outcome === "QUOTATION_SENT")!.check.state, "CONFIRMED");
  assert.equal(row.mobile.length, 10, "the owner sees the number");
  // An inquiry nobody has opened yet shows as pending.
  const fresh = await inq.createOwnerInquiry(admin as never, { mobile: "9820011223", assigneeIds: idsAll() });
  assert.ok(fresh.ok && "leadId" in fresh);
  const fr = (await inq.getInquiryTracker(50)).find((r) => r.leadId === (fresh as { leadId: string }).leadId)!;
  assert.ok(fr.recipients.every((r) => r.seenAt === null));
  assert.equal(fr.outcomes.length, 0);
});
