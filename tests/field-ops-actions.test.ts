// End-to-end Field Ops server actions on a throwaway DB, with the session / next / WhatsApp / queue edges mocked.
// Needs: node --experimental-test-module-mocks (tsx passes node flags through). Run: npm run test:fieldops
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-foa-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

const src = (p: string) => pathToFileURL(path.resolve("src", p)).href;
const sent: { body: string; toNumber: string }[] = [];
const alerts: { kind: string; title: string; critical?: boolean }[] = [];
const reviews: string[] = [];
let session: { sub: string; role: string; name: string; email: string } | null = null;

mock.module("next/cache", { namedExports: { revalidatePath: () => {}, revalidateTag: () => {} } });
mock.module("next/headers", { namedExports: { headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) } });
mock.module(src("lib/session.ts"), { namedExports: { getSession: async () => session, SESSION_COOKIE: "s" } });
const templates: { templateName: string; bodyParams: string[] }[] = [];
mock.module(src("lib/whatsapp.ts"), {
  namedExports: {
    sendWhatsApp: async (i: { body: string; toNumber: string }) => { sent.push(i); return { sent: true }; },
    sendWhatsAppTemplate: async (i: { templateName: string; bodyParams: string[] }) => { templates.push(i); return { sent: true }; },
    shouldFallBackToText: () => true,
  },
});
mock.module(src("server/notify.ts"), { namedExports: { notify: async (n: { kind: string; title: string; critical?: boolean }) => { alerts.push(n); } } });
mock.module(src("server/job-queue-handlers.ts"), {
  namedExports: {
    enqueueReviewRequest: async (id: string) => { reviews.push(id); },
    enqueueJobCompletedNotice: async () => {}, enqueueServiceStartedNotice: async () => {}, enqueueTeamDispatch: async () => {},
  },
});

let db: typeof import("../src/lib/db").db;
let actions: typeof import("../src/server/actions/jobs");
let hasOutstandingBalance: typeof import("../src/server/job-review").hasOutstandingBalance;
test.after(async () => { await db?.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const GOOD = { lat: 18.5535, lng: 73.946, acc: 25 };
const FAR = { lat: 18.58, lng: 73.946, acc: 25 };

async function setup(tag: string, over: Record<string, unknown> = {}) {
  const user = await db.user.create({ data: { name: `Ravi ${tag}`, email: `ravi-${tag}@x.test`, passwordHash: "x", role: "STAFF" } as never });
  const staff = await db.staff.create({ data: { employeeCode: `FA-${tag}`, name: `Ravi ${tag}`, mobile: "9000000888", designation: "Cleaner", dailyWage: 700, salaryType: "DAILY", userId: user.id } as never });
  const job = await db.job.create({ data: { jobNumber: `FA-JOB-${tag}`, customerName: "Asha Rao", customerMobile: "9876501555", address: "Flat 1, Kharadi", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 4000, status: "ASSIGNED", mapLink: "https://maps.google.com/?q=18.55350,73.94600", ...over } as never });
  await db.jobAssignment.create({ data: { jobId: job.id, staffId: staff.id, isLead: true } as never });
  session = { sub: user.id, role: "STAFF", name: staff.name, email: user.email };
  return { user, staff, job };
}
const otpOf = async (id: string) => (await db.job.findUniqueOrThrow({ where: { id } })).startOtp!;

test("full happy path: reached → wrong OTP → right OTP → gate → cash collected → paid, review queued", async () => {
  db = (await import("../src/lib/db")).db;
  actions = await import("../src/server/actions/jobs");
  hasOutstandingBalance = (await import("../src/server/job-review")).hasOutstandingBalance;
  const { job } = await setup("A");
  await db.payment.create({ data: { invoiceNumber: "FA-INV-A", jobId: job.id, clientName: "Asha", amount: 4000, paidAmount: 0, dueDate: new Date(), status: "PENDING" } as never });

  // cannot skip straight to the gated steps
  assert.match(String((await actions.staffUpdateJobStatus(job.id, "STARTED") as { error?: string }).error), /Reached Location/);
  assert.match(String((await actions.staffUpdateJobStatus(job.id, "COMPLETED") as { error?: string }).error), /Complete Job/);
  assert.match(String((await actions.staffVerifyStartOtp(job.id, "1234") as { error?: string }).error), /Reached Location/);

  // weak GPS refused; nothing stored
  const weak = await actions.staffReachedLocation(job.id, { ...GOOD, acc: 400 });
  assert.equal(weak.success, false);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).reachedAt, null);

  // good GPS: check-in stored, OTP sent to the customer
  const ok = await actions.staffReachedLocation(job.id, GOOD);
  assert.equal(ok.success, true);
  const j1 = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j1.status, "ON_THE_WAY");
  assert.equal(j1.gpsFlag, null);
  assert.equal(j1.reachedDistanceM, 0);
  assert.match(j1.startOtp!, /^[1-9]\d{3}$/);
  assert.equal(sent.length, 1);
  assert.ok(sent[0].body.includes(j1.startOtp!) && sent[0].toNumber === "9876501555");
  assert.equal(alerts.length, 0, "no GPS alert for an on-site check-in");

  // wrong code does not start the job; right code does
  const wrong = j1.startOtp === "1234" ? "4321" : "1234";
  assert.equal((await actions.staffVerifyStartOtp(job.id, wrong)).success, false);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, "ON_THE_WAY");
  assert.equal((await actions.staffVerifyStartOtp(job.id, j1.startOtp!)).success, true);
  const j2 = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j2.status, "STARTED");
  assert.ok(j2.startOtpVerifiedAt && j2.startedAt);

  // completion gate is payment-only: no mode → refused
  assert.equal((await actions.staffCompleteJob(job.id, { amount: 4000, mode: "" })).success, false);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, "STARTED", "still not completed");

  const done = await actions.staffCompleteJob(job.id, { amount: 4000, mode: "CASH" });
  assert.equal(done.success, true);
  const j3 = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j3.status, "COMPLETED");
  assert.equal(j3.collectedAmount, 4000);
  assert.equal(j3.collectedMode, "CASH");
  assert.equal(j3.cashCollectedByName, "Ravi A", "cash is logged to the logged-in staff member");
  assert.ok(j3.cashCollectedByStaffId && j3.cashCollectedAt);
  assert.equal(j3.cashSettledAt, null, "stays on the [CASH WITH STAFF] alert until the office receives it");
  const gps = await db.locationPing.findMany({ where: { jobId: job.id } });
  assert.equal(gps.length, 1);
  assert.equal(gps[0].kind, "CHECKIN");
  assert.equal(gps[0].subjectType, "FIELD");
  const pay = await db.payment.findFirstOrThrow({ where: { jobId: job.id } });
  assert.equal(pay.status, "PAID");
  assert.equal(pay.paidAmount, 4000);
  assert.equal(pay.mode, "CASH");
  assert.deepEqual([...new Set(reviews)], [job.id], "completion queues the Google-review request (the queue dedupes by job)");
  assert.equal(hasOutstandingBalance(await db.payment.findMany({ where: { jobId: job.id } })), false, "settled → sendReviewIfDue will let the review go out");
  assert.ok(alerts.some((a) => a.kind === "PAYMENT_RECEIVED"));
  // idempotent
  assert.equal((await actions.staffCompleteJob(job.id, { amount: 4000, mode: "CASH" }) as { unchanged?: boolean }).unchanged, true);
  assert.equal(reviews.length, 1, "no second review on a repeated tap");
});

test("out-of-zone check-in is stored, flagged and alerts the admin; a job with no pin is flagged NO_PIN", async () => {
  const { job } = await setup("B");
  alerts.length = 0;
  const r = await actions.staffReachedLocation(job.id, FAR);
  assert.equal(r.success, true);
  const j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j.gpsFlag, "OUT_OF_ZONE");
  assert.ok(j.reachedDistanceM! > 1500);
  assert.ok(alerts.some((a) => a.kind === "OPS_ESCALATION" && /OUT-OF-ZONE GPS/.test(a.title)));

  const { job: nopin } = await setup("C", { mapLink: null });
  alerts.length = 0;
  await actions.staffReachedLocation(nopin.id, GOOD);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: nopin.id } })).gpsFlag, "NO_PIN");
  assert.ok(alerts.some((a) => /no map pin/i.test(a.title)));
});

test("5 wrong start codes lock the OTP; the right one is then refused until the office intervenes", async () => {
  const { job } = await setup("D");
  await actions.staffReachedLocation(job.id, GOOD);
  const real = await otpOf(job.id);
  const wrong = real === "1111" ? "2222" : "1111";
  for (let i = 0; i < 5; i++) assert.equal((await actions.staffVerifyStartOtp(job.id, wrong)).success, false);
  const locked = await actions.staffVerifyStartOtp(job.id, real) as { error?: string };
  assert.match(String(locked.error), /Too many wrong codes/);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, "ON_THE_WAY");
});

test("payment gate: staff cannot close with Pending Approval; only an Admin can use Corporate / Credit Override (needs a reason, critical alert, payment stays unpaid, no review)", async () => {
  const admin = await db.user.create({ data: { name: "Admin E", email: "admin-e@x.test", passwordHash: "x", role: "ADMIN" } as never });
  const { job } = await setup("E");
  const staffSession = session;
  await db.payment.create({ data: { invoiceNumber: "FA-INV-E", jobId: job.id, clientName: "Asha", amount: 4000, paidAmount: 0, dueDate: new Date(), status: "PENDING" } as never });
  await actions.staffReachedLocation(job.id, GOOD);
  await actions.staffVerifyStartOtp(job.id, await otpOf(job.id));
  // Staff: only UPI (with the proof tick) or Cash. Pending Approval / Credit Override / UPI without the tick are refused and the job stays open.
  for (const input of [{ amount: 0, mode: "PENDING_APPROVAL", note: "Customer will pay owner directly on Monday" }, { amount: 0, mode: "CREDIT_OVERRIDE", note: "Corporate account" }, { amount: 4000, mode: "UPI" }, {}]) {
    assert.equal((await actions.staffCompleteJob(job.id, input as never)).success, false, JSON.stringify(input));
  }
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, "STARTED");

  // Admin: credit override needs a reason, then closes the job with the payment left open.
  session = { sub: admin.id, role: "ADMIN", name: "Altaf", email: admin.email };
  assert.match(String((await actions.officeCloseJob(job.id, { amount: 0, mode: "CREDIT_OVERRIDE" }) as { error?: string }).error), /reason/i);
  alerts.length = 0;
  reviews.length = 0;
  const r = await actions.officeCloseJob(job.id, { amount: 0, mode: "CREDIT_OVERRIDE", note: "Corporate account, invoiced monthly" });
  assert.equal(r.success, true);
  const j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j.status, "COMPLETED");
  assert.equal(j.collectedMode, "CREDIT_OVERRIDE");
  assert.equal((await db.payment.findFirstOrThrow({ where: { jobId: job.id } })).status, "PENDING");
  assert.ok(alerts.some((a) => a.kind === "OPS_ESCALATION" && a.critical && /Credit override/.test(a.title)));
  assert.equal(hasOutstandingBalance(await db.payment.findMany({ where: { jobId: job.id } })), true, "balance still open → the review request is held back");

  // Operations / Accounts cannot use the override.
  session = staffSession;
  const { job: other } = await setup("E2");
  await actions.staffReachedLocation(other.id, GOOD);
  await actions.staffVerifyStartOtp(other.id, await otpOf(other.id));
  session = { sub: admin.id, role: "OPERATIONS", name: "Francis", email: "f-e@x.test" };
  assert.equal((await actions.officeCloseJob(other.id, { amount: 0, mode: "CREDIT_OVERRIDE", note: "Corporate account" })).success, false);
});

test("a partial collection leaves the balance open and does not trigger the review", async () => {
  const { job } = await setup("F");
  await db.payment.create({ data: { invoiceNumber: "FA-INV-F", jobId: job.id, clientName: "Asha", amount: 4000, paidAmount: 0, dueDate: new Date(), status: "PENDING" } as never });
  await actions.staffReachedLocation(job.id, GOOD);
  await actions.staffVerifyStartOtp(job.id, await otpOf(job.id));
  reviews.length = 0;
  await actions.staffCompleteJob(job.id, { amount: 1500, mode: "UPI", upiConfirmed: true });
  const pay = await db.payment.findFirstOrThrow({ where: { jobId: job.id } });
  assert.equal(pay.paidAmount, 1500);
  assert.notEqual(pay.status, "PAID");
  assert.equal(hasOutstandingBalance([pay]), true, "balance still open → the review request is held back");
});

test("another staff member (not assigned) cannot check in, verify or complete someone else's job", async () => {
  const { job } = await setup("G");
  const other = await db.user.create({ data: { name: "Other", email: "other@x.test", passwordHash: "x", role: "STAFF" } as never });
  await db.staff.create({ data: { employeeCode: "FA-OTHER", name: "Other", mobile: "9000000999", designation: "Cleaner", dailyWage: 700, salaryType: "DAILY", userId: other.id } as never });
  session = { sub: other.id, role: "STAFF", name: "Other", email: other.email };
  assert.equal((await actions.staffReachedLocation(job.id, GOOD)).success, false);
  assert.equal((await actions.staffVerifyStartOtp(job.id, "1234")).success, false);
  assert.equal((await actions.staffCompleteJob(job.id, { amount: 1, mode: "CASH" })).success, false);
  session = { sub: other.id, role: "OPERATIONS", name: "Francis", email: "f@x.test" };
  assert.equal((await actions.staffReachedLocation(job.id, GOOD)).success, false, "office roles cannot use the staff check-in");
});

test("office close: Admin / Operations / Accounts verify payment and close; settles pending approval; marks cash received; staff and supervisors cannot", async () => {
  const office = await db.user.create({ data: { name: "Office", email: "office-h@x.test", passwordHash: "x", role: "ADMIN" } as never });
  const { job } = await setup("H");
  await actions.staffReachedLocation(job.id, GOOD);
  await actions.staffVerifyStartOtp(job.id, await otpOf(job.id));
  await actions.staffCompleteJob(job.id, { amount: 0, mode: "PENDING_APPROVAL", note: "Customer will pay the office" });

  session = { sub: "x", role: "STAFF", name: "Ravi", email: "r@x.test" };
  assert.equal((await actions.officeCloseJob(job.id, { amount: 4000, mode: "UPI" })).success, false);
  session = { sub: "x", role: "SUPERVISOR", name: "Sup", email: "s@x.test" };
  assert.equal((await actions.officeCloseJob(job.id, { amount: 4000, mode: "UPI" })).success, false);
  session = { sub: office.id, role: "ACCOUNTS", name: "Shoaib", email: "sh@x.test" };
  assert.equal((await actions.officeCloseJob(job.id, { amount: 4000, mode: "PENDING_APPROVAL", note: "still pending" })).success, false, "must pick a real mode");
  assert.equal((await actions.officeCloseJob(job.id, { amount: 4000, mode: "CASH" })).success, true);
  const j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j.collectedMode, "CASH");
  assert.ok(j.cashSettledAt, "office cash is settled at once");
  assert.equal((await db.payment.findFirstOrThrow({ where: { jobId: job.id } })).paidAmount, 4000);

  // closing an in-progress job without the OTP gate (Super Admin)
  const { job: live } = await setup("I");
  await actions.staffReachedLocation(live.id, GOOD);
  session = { sub: office.id, role: "ADMIN", name: "Altaf", email: "a@x.test" };
  assert.equal((await actions.officeCloseJob(live.id, { amount: 4000, mode: "UPI" })).success, true);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: live.id } })).status, "COMPLETED");

  // mark cash received
  const { job: cash } = await setup("J");
  await actions.staffReachedLocation(cash.id, GOOD);
  await actions.staffVerifyStartOtp(cash.id, await otpOf(cash.id));
  await actions.staffCompleteJob(cash.id, { amount: 4000, mode: "CASH" });
  session = { sub: "x", role: "STAFF", name: "Ravi", email: "r@x.test" };
  assert.equal((await actions.officeMarkCashReceived(cash.id)).success, false);
  session = { sub: office.id, role: "OPERATIONS", name: "Francis", email: "f@x.test" };
  assert.equal((await actions.officeMarkCashReceived(cash.id)).success, true);
  const c = await db.job.findUniqueOrThrow({ where: { id: cash.id } });
  assert.ok(c.cashSettledAt);
  assert.equal(c.cashSettledByName, "Francis");
});

test("tracking: only the Super Admin can switch it; Francis / Shoaib / staff are refused server-side; supervisor check-ins carry no coordinates in the job log", async () => {
  const tracking = await import("../src/server/actions/tracking");
  for (const role of ["OPERATIONS", "ACCOUNTS", "SUPERVISOR", "STAFF"]) {
    session = { sub: "x", role, name: role, email: "x@x.test" };
    assert.equal((await tracking.setGpsTracking(false)).success, false, role);
  }
  assert.equal((await db.companySettings.findFirst())?.gpsTrackingEnabled ?? true, true, "still on");
  session = { sub: "x", role: "ADMIN", name: "Altaf", email: "a@x.test" };
  assert.equal((await tracking.setGpsTracking(false)).success, true);
  assert.equal((await db.companySettings.findFirstOrThrow()).gpsTrackingEnabled, false);
  assert.equal((await tracking.setGpsTracking(true)).success, true);

  // a supervisor on the staff flow is logged as SUPERVISOR; their coordinates stay out of the office-readable job log
  const user = await db.user.create({ data: { name: "Francis", email: "francis-t@x.test", passwordHash: "x", role: "STAFF" } as never });
  const staff = await db.staff.create({ data: { employeeCode: "FA-FR", name: "Francis", mobile: "9000000123", designation: "Operations Manager", dailyWage: 900, salaryType: "DAILY", userId: user.id } as never });
  const job = await db.job.create({ data: { jobNumber: "FA-JOB-SUP", customerName: "Asha", customerMobile: "9876501666", address: "Kharadi", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 4000, status: "ASSIGNED", mapLink: "https://maps.google.com/?q=18.55350,73.94600" } as never });
  await db.jobAssignment.create({ data: { jobId: job.id, staffId: staff.id, isLead: true } as never });
  session = { sub: user.id, role: "STAFF", name: "Francis", email: user.email };
  assert.equal((await actions.staffReachedLocation(job.id, GOOD)).success, true);
  const ping = await db.locationPing.findFirstOrThrow({ where: { staffId: staff.id } });
  assert.equal(ping.subjectType, "SUPERVISOR");
  const logs = await db.activityLog.findMany({ where: { jobId: job.id } });
  assert.ok(logs.every((l) => !/18\.5|73\.9/.test(l.action)), "no coordinates in the job activity log");

  // active-shift pings: rate-limited, needs an active own job, honours the switch
  assert.equal((await tracking.recordLocationPing(job.id, GOOD)).success, true);
  assert.equal(await db.locationPing.count({ where: { staffId: staff.id } }), 1, "too soon after the check-in → skipped");
});

test("start OTP goes out as the Meta template only when switched on; otherwise plain text", async () => {
  process.env.WHATSAPP_USE_TEMPLATES = "on";
  process.env.WHATSAPP_START_OTP_TEMPLATE = "v1";
  const { job } = await setup("K");
  templates.length = 0;
  await actions.staffReachedLocation(job.id, GOOD);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(templates.length, 1);
  assert.equal(templates[0].templateName, "sahara_start_otp_v1");
  assert.equal(templates[0].bodyParams[1], await otpOf(job.id));
  delete process.env.WHATSAPP_START_OTP_TEMPLATE;
});

test("office supervisors ping from any open page (no job) into the log as SUPERVISOR; technicians without a live job do not", async () => {
  const tracking = await import("../src/server/actions/tracking");
  const fr = await db.user.create({ data: { name: "Francis O", email: "francis-o@x.test", passwordHash: "x", role: "OPERATIONS" } as never });
  session = { sub: fr.id, role: "OPERATIONS", name: "Francis O", email: fr.email };
  assert.equal((await tracking.recordLocationPing(null, GOOD)).success, true);
  const row = await db.locationPing.findFirstOrThrow({ where: { staffName: "Francis O" } });
  assert.equal(row.subjectType, "SUPERVISOR");
  assert.equal(row.jobId, null);
  assert.equal(row.kind, "PING");
  // the call returns no coordinates to the caller
  assert.ok(!JSON.stringify(await tracking.recordLocationPing(null, GOOD)).includes("18.55"));

  const tech = await db.user.create({ data: { name: "Tech O", email: "tech-o@x.test", passwordHash: "x", role: "STAFF" } as never });
  await db.staff.create({ data: { employeeCode: "FA-TO", name: "Tech O", mobile: "9000000321", designation: "Cleaner", dailyWage: 700, salaryType: "DAILY", userId: tech.id } as never });
  session = { sub: tech.id, role: "STAFF", name: "Tech O", email: tech.email };
  assert.equal((await tracking.recordLocationPing(null, GOOD) as { skipped?: string }).skipped, "no-active-job");
  assert.equal(await db.locationPing.count({ where: { staffName: "Tech O" } }), 0);
});

test("continuous pings (2026-11-14): on the way → after Reached → in progress keep pinging from any page; completed stops; a checked-in shift pings without a job", async () => {
  const tracking = await import("../src/server/actions/tracking");
  let shift = 0;
  const realNow = Date.now;
  let clock: { mock: { restore: () => void } } | null = null;
  const realClock = () => { clock?.mock.restore(); clock = null; };
  const tick = () => { shift += 3 * 60_000; realClock(); clock = mock.method(Date, "now", () => realNow() + shift); };
  try {
    const { staff, job } = await setup("P");
    const count = () => db.locationPing.count({ where: { staffId: staff.id, kind: "PING" } });
    assert.equal((await tracking.getLocationPingStatus()).active, false, "assigned, not yet on the way → no GPS wake-up");
    await db.job.update({ where: { id: job.id }, data: { status: "ON_THE_WAY", onTheWayAt: new Date() } });
    assert.equal((await tracking.getLocationPingStatus()).active, true);
    tick(); assert.equal((await tracking.recordLocationPing(null, GOOD)).success, true);
    assert.equal(await count(), 1);
    const first = await db.locationPing.findFirstOrThrow({ where: { staffId: staff.id, kind: "PING" } });
    assert.equal(first.jobId, job.id, "the server attaches the live job even when the page sent none");
    // Reached Location (still ON_THE_WAY) → pings continue
    assert.equal((await actions.staffReachedLocation(job.id, GOOD)).success, true);
    tick(); await tracking.recordLocationPing(null, GOOD);
    assert.equal(await count(), 2, "pinging continues after Reached Location");
    // In progress
    await actions.staffVerifyStartOtp(job.id, await otpOf(job.id));
    tick(); await tracking.recordLocationPing(job.id, GOOD);
    assert.equal(await count(), 3, "pinging continues while In progress");
    // too soon (real clock, right after the last ping) → rate-limited, not stored
    realClock();
    assert.equal((await tracking.recordLocationPing(job.id, GOOD) as { skipped?: string }).skipped, "too-soon");
    // Completed → stops (not checked in for a shift)
    await actions.staffCompleteJob(job.id, { amount: 4000, mode: "CASH" });
    tick();
    assert.equal((await tracking.recordLocationPing(job.id, GOOD) as { skipped?: string }).skipped, "no-active-job");
    assert.equal((await tracking.getLocationPingStatus()).active, false);
    // Checked in for the shift (no live job) → pings with no job; checked out → stops
    await db.attendance.create({ data: { staffId: staff.id, date: new Date(), checkInTime: new Date(), status: "PRESENT" } as never });
    assert.equal((await tracking.getLocationPingStatus()).active, true);
    tick(); assert.equal((await tracking.recordLocationPing(null, GOOD)).success, true);
    assert.equal(await count(), 4);
    await db.attendance.updateMany({ where: { staffId: staff.id }, data: { checkOutTime: new Date() } });
    tick();
    assert.equal((await tracking.recordLocationPing(null, GOOD) as { skipped?: string }).skipped, "no-active-job");
  } finally {
    realClock();
  }
});

test("live staff map (owner 2026-11-14): Super Admin sees everyone incl. Shoaib & Francis; Shoaib and Francis see only active field technicians; staff see nothing", async () => {
  const ops = await import("../src/server/field-ops");
  const mkPerson = async (tag: string, role: string, designation: string) => {
    const u = await db.user.create({ data: { name: tag, email: `${tag}@map.test`, passwordHash: "x", role } as never });
    const s = await db.staff.create({ data: { employeeCode: `MAP-${tag}`, name: tag, mobile: "9000000777", designation, dailyWage: 700, salaryType: "DAILY", userId: u.id } as never });
    return s;
  };
  const onJob = await mkPerson("MapTechJob", "STAFF", "Cleaner");
  const onShift = await mkPerson("MapTechShift", "STAFF", "Cleaner");
  const offShift = await mkPerson("MapTechOff", "STAFF", "Cleaner");
  const altaf = await mkPerson("MapAltaf", "ADMIN", "Owner");
  const francis = await mkPerson("MapFrancis", "OPERATIONS", "Operations Manager");
  const shoaib = await mkPerson("MapShoaib", "ACCOUNTS", "Accounts & Enquiry");
  const officeOnJob = await mkPerson("MapSupervisorOnJob", "STAFF", "Supervisor");
  const job = await db.job.create({ data: { jobNumber: "MAP-JOB", customerName: "X", customerMobile: "9876500001", address: "A", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 1000, status: "STARTED" } as never });
  for (const s of [onJob, officeOnJob, altaf]) await db.jobAssignment.create({ data: { jobId: job.id, staffId: s.id } as never });
  await db.attendance.create({ data: { staffId: onShift.id, date: new Date(), checkInTime: new Date(), status: "PRESENT" } as never });
  // pings (a frozen FIELD row for the Super Admin's staff profile too, to prove the CURRENT role is re-checked)
  const pin = (s: { id: string; name: string }, subjectType: string) => db.locationPing.create({ data: { staffId: s.id, staffName: s.name, kind: "PING", lat: 18.55, lng: 73.94, accuracyM: 20, subjectType } });
  await pin(onJob, "FIELD"); await pin(onShift, "FIELD"); await pin(offShift, "FIELD"); await pin(altaf, "FIELD");
  await pin(francis, "SUPERVISOR"); await pin(shoaib, "SUPERVISOR"); await pin(officeOnJob, "SUPERVISOR");
  await db.locationPing.create({ data: { staffId: "user:office-only", staffName: "Office login", kind: "PING", lat: 18.55, lng: 73.94, subjectType: "SUPERVISOR" } });
  const names = (rows: { staffName: string }[]) => rows.map((r) => r.staffName).filter((n) => n.startsWith("Map") || n === "Office login").sort();

  const asAdmin = await ops.getLiveLocations({ role: "ADMIN" });
  assert.deepEqual(names(asAdmin), ["MapAltaf", "MapFrancis", "MapShoaib", "MapSupervisorOnJob", "MapTechJob", "MapTechOff", "MapTechShift", "Office login"]);
  const asShoaib = await ops.getLiveLocations({ role: "ACCOUNTS", staffId: shoaib.id });
  assert.deepEqual(names(asShoaib), ["MapTechJob", "MapTechShift"], "only active field technicians — no Super Admin, no office, no off-shift");
  assert.ok(asShoaib.every((r) => r.type === "FIELD" && r.active));
  for (const role of ["OPERATIONS", "SUPERVISOR"]) assert.deepEqual(names(await ops.getLiveLocations({ role, staffId: francis.id })), ["MapTechJob", "MapTechShift"], `${role} (Francis / Shoaib) sees only active field technicians`);
  assert.deepEqual(await ops.getLiveLocations({ role: "STAFF", staffId: francis.id }), [], "staff get no map");
});
