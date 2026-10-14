// Owner Quick Add Inquiry (2026-10-14). Run: npm run test:inquiry
// Fresh throwaway SQLite DB (scripts/db-setup.mjs) — never dev.db, no network, no WhatsApp/SMS.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseIndianMobile } from "../src/lib/inquiry-input";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-inquiry-"));
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
const alerts = (kind = "OWNER_INQUIRY", where: object = {}) => db.notification.count({ where: { kind, ...where } });

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

test("mobile parsing: pasted formats normalise; invalid input is rejected", () => {
  for (const raw of ["98765 43210", "+91 98765 43210", "+919876543210", "919876543210", "09876543210", "98765-43210", "(98765) 43210", " 9876543210 "]) {
    const r = parseIndianMobile(raw);
    assert.ok(r.ok && r.mobile === "9876543210", raw);
  }
  for (const raw of ["", "   ", "12345", "98765", "1234567890", "5876543210", "98765432101234", "98765abcde", "abc", "98765 4321 0 extra", null, undefined, 9876543210, {}]) {
    assert.equal(parseIndianMobile(raw).ok, false, String(raw));
  }
});

test("Altaf creates an inquiry from a pasted number: saved as NEW (no booking), alerts only the chosen team", async () => {
  const r = await inq.createOwnerInquiry(admin as never, { mobile: "+91 98200 11111", note: "Needs 3BHK deep cleaning this weekend", assigneeIds: idsAll() });
  assert.ok(r.ok);
  if (!r.ok || !("leadId" in r)) return;
  const lead = (await db.lead.findUnique({ where: { id: r.leadId } }))!;
  assert.equal(lead.mobile, "9820011111");
  assert.equal(lead.stage, "NEW");
  assert.match(lead.name, /^New inquiry 1111$/, "name is optional");
  assert.equal(lead.createdById, admin.id);
  assert.equal(lead.assignedToId, shoyab.id);
  assert.equal(lead.notes, "Needs 3BHK deep cleaning this weekend");
  assert.equal(await db.job.count({ where: { leadId: lead.id } }), 0, "no job / booking created");
  assert.equal(await db.payment.count({}), 0);
  assert.equal(await alerts("OWNER_INQUIRY", { userId: shoyab.id }), 1);
  assert.equal(await alerts("OWNER_INQUIRY", { userId: francis.id }), 1);
  assert.equal(await alerts("OWNER_INQUIRY", { userId: admin.id }), 0);
  const n = (await db.notification.findFirst({ where: { userId: francis.id, kind: "OWNER_INQUIRY" } }))!;
  assert.equal(n.title, "NEW INQUIRY — RESPOND NOW");
  assert.match(n.body ?? "", /Sahara Cleaning Services — assigned by Altaf\. Please review the inquiry and respond promptly\./);
  assert.ok(!/\d{10}/.test(`${n.title} ${n.body}`), "no phone number in the notification text");
  assert.equal(n.critical, true);
  // Audit trail + no external messages.
  for (const action of ["INQUIRY_CREATED_BY_OWNER", "INQUIRY_ASSIGNED"]) assert.equal(await db.auditLog.count({ where: { entityId: lead.id, action } }), 1, action);
  assert.ok(!(await db.auditLog.findMany({ where: { entityId: lead.id } })).some((a) => a.summary.includes("9820011111")), "audit log keeps the number masked");
  assert.equal(await db.whatsAppMessage.count({}), 0, "no WhatsApp message");
  assert.equal(await db.smsMessage.count({}), 0, "no SMS");
});

test("only the Super Admin can create; assignees are validated", async () => {
  assert.deepEqual(await inq.createOwnerInquiry(shoyab as never, { mobile: "9820022222", assigneeIds: idsAll() }), { ok: false, error: "Only the Super Admin can add owner inquiries" });
  assert.equal((await inq.createOwnerInquiry(francis as never, { mobile: "9820022222", assigneeIds: idsAll() })).ok, false);
  assert.equal((await inq.createOwnerInquiry(admin as never, { mobile: "9820022222", assigneeIds: [] })).ok, false);
  assert.equal((await inq.createOwnerInquiry(admin as never, { mobile: "9820022222", assigneeIds: [admin.id] })).ok, false, "cannot route to a non-assignable role");
  assert.equal((await inq.createOwnerInquiry(admin as never, { mobile: "9820022222", assigneeIds: ["nope"] })).ok, false);
  assert.equal((await inq.createOwnerInquiry(admin as never, { mobile: "12345", assigneeIds: idsAll() })).ok, false);
  assert.equal(await db.lead.count({ where: { mobile: "9820022222" } }), 0);
});

test("duplicate number with an active inquiry: shown, not silently duplicated; team can be re-alerted", async () => {
  const before = await db.lead.count();
  const r = await inq.createOwnerInquiry(admin as never, { mobile: "9820011111", assigneeIds: idsAll() });
  assert.ok(!r.ok && "duplicate" in r && r.duplicate.active.length === 1);
  assert.equal(await db.lead.count(), before, "no new lead");
  const existing = (r as { duplicate: { active: { id: string }[] } }).duplicate.active[0];
  const again = await inq.createOwnerInquiry(admin as never, { mobile: "9820011111", assigneeIds: [francis.id], mode: "ALERT_EXISTING", leadId: existing.id });
  assert.ok(again.ok && "alertedExisting" in again && again.alertedExisting);
  assert.equal(await db.lead.count(), before);
  assert.equal(await alerts("OWNER_INQUIRY", { userId: francis.id }), 2);
  assert.equal(await db.auditLog.count({ where: { action: "INQUIRY_ALERT_RESENT" } }), 1);
});

test("double-click / concurrent submit creates exactly one inquiry", async () => {
  const input = { mobile: "9820033333", assigneeIds: idsAll() };
  const [a, b] = await Promise.all([inq.createOwnerInquiry(admin as never, input), inq.createOwnerInquiry(admin as never, input)]);
  assert.equal([a, b].filter((x) => x.ok).length, 1);
  assert.equal(await db.lead.count({ where: { mobile: "9820033333" } }), 1);
  const third = await inq.createOwnerInquiry(admin as never, input);
  assert.equal(third.ok, false);
  assert.equal(await db.lead.count({ where: { mobile: "9820033333" } }), 1);
});

test("closed history: the owner decides — new inquiry or reopen a cancelled one; history is never overwritten", async () => {
  const old = await db.lead.create({ data: { leadNumber: "LD-OLD-1", name: "Old Customer", mobile: "9820044444", area: "Baner", service: "HOME_DEEP_CLEANING" as never, source: "CALL" as never, stage: "CANCELLED" as never, notes: "original note" } });
  const r = await inq.createOwnerInquiry(admin as never, { mobile: "9820044444", name: "Different Name", assigneeIds: idsAll() });
  assert.ok(!r.ok && "duplicate" in r && r.duplicate.active.length === 0 && r.duplicate.closed.length === 1);
  // Reopen only a cancelled lead; the old data stays as it was.
  const reopened = await inq.createOwnerInquiry(admin as never, { mobile: "9820044444", assigneeIds: idsAll(), mode: "REOPEN", leadId: old.id });
  assert.ok(reopened.ok && "reopened" in reopened && reopened.reopened);
  const after = (await db.lead.findUnique({ where: { id: old.id } }))!;
  assert.equal(after.stage, "NEW");
  assert.equal(after.name, "Old Customer");
  assert.equal(after.notes, "original note");
  assert.equal(await db.auditLog.count({ where: { entityId: old.id, action: "INQUIRY_REOPENED" } }), 1);
  // A completed lead cannot be "reopened"; a new inquiry for that number is allowed after the owner confirms.
  const done = await db.lead.create({ data: { leadNumber: "LD-OLD-2", name: "Done Customer", mobile: "9820055555", area: "Kothrud", service: "HOME_DEEP_CLEANING" as never, source: "CALL" as never, stage: "COMPLETED" as never } });
  assert.equal((await inq.createOwnerInquiry(admin as never, { mobile: "9820055555", assigneeIds: idsAll(), mode: "REOPEN", leadId: done.id })).ok, false);
  const fresh = await inq.createOwnerInquiry(admin as never, { mobile: "9820055555", assigneeIds: idsAll(), mode: "NEW" });
  assert.ok(fresh.ok && "leadId" in fresh);
  assert.equal((await db.lead.findUnique({ where: { id: done.id } }))!.stage, "COMPLETED");
  assert.equal(await db.lead.count({ where: { mobile: "9820055555" } }), 2);
});

test("alerts per role: Shoyab sees the number, Francis does not; acknowledge is per user and never re-pops", async () => {
  const s = await inq.listInquiryAlerts({ id: shoyab.id, role: "ACCOUNTS" }, 20);
  const f = await inq.listInquiryAlerts({ id: francis.id, role: "OPERATIONS" }, 20);
  assert.ok(s.length >= 3 && f.length >= 3);
  const first = s.find((a) => a.note === "Needs 3BHK deep cleaning this weekend")!;
  assert.equal(first.mobile, "9820011111");
  assert.equal(first.assignedBy, "Altaf");
  assert.deepEqual(first.assignees.sort(), ["Francis", "Shoyab Kazi"].sort());
  assert.equal(first.canOpen, true);
  const fAlert = f.find((a) => a.leadId === first.leadId)!;
  assert.equal(fAlert.mobile, null, "Operations never receives the customer's number");
  assert.equal(fAlert.canOpen, true, "NEW leads are inside Operations' lead scope");
  assert.ok(!JSON.stringify(f).includes("9820011111"));
  assert.deepEqual(await inq.listInquiryAlerts({ id: admin.id, role: "ADMIN" }), [], "the sender gets no alert");

  // Francis acknowledges — Shoyab's copy stays unread.
  const ack = await inq.acknowledgeInquiryAlert(francis, fAlert.id);
  assert.ok(ack.ok && !ack.already);
  assert.ok(!(await inq.listInquiryAlerts({ id: francis.id, role: "OPERATIONS" }, 20)).some((a) => a.id === fAlert.id));
  assert.ok((await inq.listInquiryAlerts({ id: shoyab.id, role: "ACCOUNTS" }, 20)).some((a) => a.leadId === first.leadId));
  // Idempotent; cannot acknowledge someone else's alert.
  assert.ok((await inq.acknowledgeInquiryAlert(francis, fAlert.id)).ok);
  assert.equal((await inq.acknowledgeInquiryAlert(francis, first.id)).ok, false);
  assert.equal(await db.auditLog.count({ where: { entityId: first.leadId, action: "INQUIRY_ALERT_ACK", actorName: "Francis" } }), 1, "one audit row, not repeated");
});

test("Operations cannot open a lead outside its scope; offline users still see unread alerts later", async () => {
  const lead = (await db.lead.findFirst({ where: { mobile: "9820011111" } }))!;
  await db.lead.update({ where: { id: lead.id }, data: { stage: "QUOTATION" as never } });
  const f = await inq.listInquiryAlerts({ id: francis.id, role: "OPERATIONS" }, 20);
  const s = await inq.listInquiryAlerts({ id: shoyab.id, role: "ACCOUNTS" }, 20);
  assert.equal(f.find((a) => a.leadId === lead.id)?.canOpen ?? false, false, "acknowledged here, but also outside scope");
  assert.equal(s.find((a) => a.leadId === lead.id)!.canOpen, true, "Accounts still opens it (unread → shown on the next load)");
});
