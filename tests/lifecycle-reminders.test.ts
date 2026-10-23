// Lifecycle reminders (owner 2026-10-23): 6 / 12-month re-booking + overdue B2B payment follow-ups.
// Run: npx tsx --test tests/lifecycle-reminders.test.ts   Synthetic data; throwaway DB; Meta API is a stub (no network).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { addMonths, isDeepCleaningName, istHour, nextPaymentReminder, rebookMilestone } from "../src/lib/lifecycle-reminders";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-lr-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_OUTBOUND_MODE", "WHATSAPP_REMINDERS"]) delete process.env[k];

let db: typeof import("../src/lib/db").db;
let lr: typeof import("../src/server/lifecycle-reminders");
const realFetch = globalThis.fetch;
const calls: { to: string; template: string; params: string[] }[] = [];
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  lr = await import("../src/server/lifecycle-reminders");
  Object.assign(process.env, { WHATSAPP_ACCESS_TOKEN: "test-token-not-real", WHATSAPP_PHONE_NUMBER_ID: "000000000000000" });
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ to: b.to, template: b.template?.name, params: (b.template?.components?.find((c: { type: string }) => c.type === "body")?.parameters ?? []).map((p: { text: string }) => p.text) });
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${calls.length}` }] }), { status: 200 });
  }) as typeof fetch;
});
test.after(async () => { globalThis.fetch = realFetch; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("pure rules: month arithmetic, 6/12-month windows, payment cadence, deep-clean names, IST hours", () => {
  assert.equal(addMonths(new Date("2026-08-31T06:30:00Z"), 6).toISOString().slice(0, 10), "2027-02-28"); // end-of-month clamp
  const last = new Date("2026-04-20T06:30:00Z");
  assert.equal(rebookMilestone(last, new Date("2026-10-19T06:30:00Z")), null); // a day early
  assert.equal(rebookMilestone(last, new Date("2026-10-20T06:30:00Z")), 6);
  assert.equal(rebookMilestone(last, new Date("2026-11-02T06:30:00Z")), 6); // inside the 14-day grace
  assert.equal(rebookMilestone(last, new Date("2026-11-04T06:30:00Z")), null); // grace over
  assert.equal(rebookMilestone(last, new Date("2027-04-21T06:30:00Z")), 12);
  const due = new Date("2026-10-10T00:00:00Z");
  assert.equal(nextPaymentReminder(due, { count: 0, lastAt: null }, new Date("2026-10-10T20:00:00Z")), null); // not yet a day overdue
  assert.equal(nextPaymentReminder(due, { count: 0, lastAt: null }, new Date("2026-10-11T01:00:00Z")), 1);
  assert.equal(nextPaymentReminder(due, { count: 1, lastAt: new Date("2026-10-11T05:00:00Z") }, new Date("2026-10-17T05:00:00Z")), null);
  assert.equal(nextPaymentReminder(due, { count: 1, lastAt: new Date("2026-10-11T05:00:00Z") }, new Date("2026-10-18T05:00:00Z")), 2);
  assert.equal(nextPaymentReminder(due, { count: 3, lastAt: new Date("2026-10-01T00:00:00Z") }, new Date("2027-01-01T00:00:00Z")), null);
  assert.deepEqual(["Full House Deep Cleaning", "Home Deep Cleaning", "Sofa Cleaning", null].map(isDeepCleaningName), [true, true, false, false]);
  assert.deepEqual([istHour(new Date("2026-10-23T04:30:00Z")), istHour(new Date("2026-10-23T14:00:00Z"))], [10, 19]);
});

const NOW = new Date("2026-10-23T06:00:00Z"); // 11:30 IST
const T = (iso: string) => new Date(`${iso}T06:30:00Z`);

test("sweep: due lists, opt-in/opt-out/busy rules, mode + switch gates, once only, payment follow-up cadence", async () => {
  let n = 0;
  const cust = (name: string, mobile: string, extra: Record<string, unknown> = {}) => db.customer.create({ data: { name, mobile, customerNumber: `C-${++n}`, ...extra } });
  const lead = (mobile: string, consent: string) => db.lead.create({ data: { name: "L", mobile, leadNumber: `L-${++n}`, area: "Baner", service: "HOME_DEEP_CLEANING", source: "CALL", marketingConsent: consent, createdAt: T("2025-01-01") } as never });
  const job = (mobile: string, date: string, status = "COMPLETED") => db.job.create({ data: { jobNumber: `J-${++n}`, customerName: "x", customerMobile: mobile, address: "a", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: T(date), scheduledTime: "10:00 AM", jobValue: 1, status } as never });

  const a = await cust("Asha Rao", "9811111111"); await lead(a.mobile, "OPT_IN"); await job(a.mobile, "2026-04-20"); // 6 months, opted in → due
  const b = await cust("Bina Shah", "9822222222"); await lead(b.mobile, "UNKNOWN"); await job(b.mobile, "2026-04-20"); // no opt-in → never
  const c = await cust("Chitra Das", "9833333333"); await lead(c.mobile, "OPT_IN"); await job(c.mobile, "2026-04-20"); await job(c.mobile, "2026-11-30", "ASSIGNED"); // already booked again → skip
  const d = await cust("Dev Nair", "9844444444"); await lead(d.mobile, "OPT_IN"); await job(d.mobile, "2025-10-20"); // 12 months → due
  const e = await cust("Esha Iyer", "9855555555"); await lead(e.mobile, "OPT_IN"); // only MyBillBook history says deep clean
  await db.mybillbookInvoice.create({ data: { invoiceNo: "H1", invoiceKey: "i/h1", invoiceDate: T("2026-04-21"), contactName: "Esha", amount: 5000, status: "Paid", invoiceLink: "https://mybillbook.in/i/h1", serviceName: "Full House Deep Cleaning", customerId: e.id } });
  const f = await cust("Farah Khan", "9866666666"); await lead(f.mobile, "OPT_IN"); await job(f.mobile, "2026-05-25"); // 5 months → not yet
  const g = await cust("Gita Pai", "9877777777"); await lead(g.mobile, "OPT_IN"); await job(g.mobile, "2026-04-20"); // opted in, then replied STOP
  await db.whatsAppConsent.create({ data: { phoneNumber: "919877777777", optedOut: true, optedOutVia: "CUSTOMER_REPLY" } });

  const corp = await cust("Acme Traders", "9899999991", { contactType: "CORPORATE" });
  const inv = (no: string, over: Record<string, unknown>) => db.mybillbookInvoice.create({ data: { invoiceNo: no, invoiceKey: `i/${no}`, invoiceDate: T("2026-09-20"), contactName: "Acme", amount: 11800, remaining: 11800, status: "Unpaid", invoiceLink: `https://mybillbook.in/i/${no}`, dataset: "GST", gstin: "27ABCDE1234F1Z5", customerId: corp.id, partyMobile: corp.mobile, dueDate: T("2026-10-10"), ...over } });
  await inv("P1", {}); // overdue by 13 days → follow-up #1
  await inv("P2", { dueDate: T("2026-10-23") }); // due today, not yet overdue
  await inv("P3", { dataset: "B2C", gstin: null, customerId: a.id, partyMobile: a.mobile }); // a private (non-GST) customer's unpaid invoice → not a B2B follow-up
  await inv("P4", { remaining: 0, status: "Paid" }); // paid

  const names = (xs: { name: string }[]) => xs.map((x) => x.name).sort();
  const rebook = await lr.collectRebook(NOW);
  assert.deepEqual(names(rebook), ["Asha Rao", "Dev Nair", "Esha Iyer"]);
  assert.deepEqual(rebook.map((r) => [r.name, r.milestone]).sort(), [["Asha Rao", 6], ["Dev Nair", 12], ["Esha Iyer", 6]]);
  assert.deepEqual((await lr.collectPayments(NOW)).map((p) => [p.invoiceNo, p.number]), [["P1", 1]]);

  // Preview never sends; the switch must be on; TEST mode holds everything back (and records nothing, so LIVE can send later).
  assert.deepEqual(await lr.runLifecycleSweep({ now: NOW, send: false }), { sent: 0, failed: 0, blockedByMode: 0, capped: 0, rebookDue: 3, paymentsDue: 1, note: null });
  assert.match((await lr.runLifecycleSweep({ now: NOW, send: true })).note ?? "", /WHATSAPP_REMINDERS is not on/);
  process.env.WHATSAPP_REMINDERS = "on";
  assert.match((await lr.runLifecycleSweep({ now: new Date("2026-10-23T16:00:00Z"), send: true })).note ?? "", /Outside reminder hours/);
  const test1 = await lr.runLifecycleSweep({ now: NOW, send: true });
  assert.deepEqual([test1.sent, test1.blockedByMode], [0, 4]);
  assert.equal(calls.length, 0);
  assert.equal(await db.reminderLog.count(), 0);

  // LIVE: everything due goes out once.
  process.env.WHATSAPP_OUTBOUND_MODE = "live";
  const live = await lr.runLifecycleSweep({ now: NOW, send: true });
  assert.deepEqual([live.sent, live.failed, live.blockedByMode], [4, 0, 0]);
  assert.deepEqual(calls.map((c) => [c.template, c.to]).sort(), [
    ["sahara_payment_due_reminder_v1", "919899999991"], ["sahara_rebook_reminder_v1", "919811111111"], ["sahara_rebook_reminder_v1", "919844444444"], ["sahara_rebook_reminder_v1", "919855555555"],
  ]);
  assert.deepEqual(calls.find((c) => c.to === "919811111111")!.params, ["Asha", "6 months", "Home Deep Cleaning"]);
  assert.deepEqual(calls.find((c) => c.to === "919844444444")!.params.slice(0, 2), ["Dev", "1 year"]);
  assert.deepEqual(calls.find((c) => c.template === "sahara_payment_due_reminder_v1")!.params, ["Acme Traders", "P1", "11,800", "10 Oct 2026"]);
  assert.equal(await db.reminderLog.count({ where: { status: "SENT" } }), 4);

  // Same day again: nothing is sent twice. A week later: the second payment follow-up only.
  calls.length = 0;
  assert.equal((await lr.runLifecycleSweep({ now: NOW, send: true })).sent, 0);
  const week = new Date(NOW.getTime() + 7 * 24 * 3600 * 1000 + 3600 * 1000);
  const next = await lr.collectPayments(week);
  assert.deepEqual(next.map((p) => [p.invoiceNo, p.number]), [["P1", 2], ["P2", 1]]);
  assert.equal((await lr.runLifecycleSweep({ now: week, send: true })).sent, 2 + (await lr.collectRebook(week)).length);
  assert.ok(calls.every((c) => c.template === "sahara_payment_due_reminder_v1" || c.template === "sahara_rebook_reminder_v1"));

  // The daily scheduler hook sweeps at most once per IST day.
  await db.reminderLog.deleteMany({ where: { kind: "SWEEP" } });
  await lr.maybeRunDailySweep(NOW);
  await lr.maybeRunDailySweep(NOW);
  assert.equal(await db.reminderLog.count({ where: { kind: "SWEEP" } }), 1);
});
