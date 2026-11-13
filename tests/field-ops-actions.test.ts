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
mock.module(src("lib/whatsapp.ts"), { namedExports: { sendWhatsApp: async (i: { body: string; toNumber: string }) => { sent.push(i); return { sent: true }; } } });
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

  // completion gate: no photo → refused; with photo but no mode → refused
  assert.match(String((await actions.staffCompleteJob(job.id, { amount: 4000, mode: "CASH" }) as { error?: string }).error), /after-service photo/);
  await actions.addJobPhoto(job.id, "AFTER", "/uploads/photos/a.webp");
  assert.equal((await actions.staffCompleteJob(job.id, { amount: 4000, mode: "" })).success, false);
  assert.equal((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status, "STARTED", "still not completed");

  const done = await actions.staffCompleteJob(job.id, { amount: 4000, mode: "CASH" });
  assert.equal(done.success, true);
  const j3 = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j3.status, "COMPLETED");
  assert.equal(j3.collectedAmount, 4000);
  assert.equal(j3.collectedMode, "CASH");
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

test("Pending Approval: needs a reason, raises a critical admin alert, leaves the payment unpaid and sends NO review request", async () => {
  const { job } = await setup("E");
  await db.payment.create({ data: { invoiceNumber: "FA-INV-E", jobId: job.id, clientName: "Asha", amount: 4000, paidAmount: 0, dueDate: new Date(), status: "PENDING" } as never });
  await actions.staffReachedLocation(job.id, GOOD);
  await actions.staffVerifyStartOtp(job.id, await otpOf(job.id));
  await actions.addJobPhoto(job.id, "AFTER", "/uploads/photos/e.webp");
  assert.match(String((await actions.staffCompleteJob(job.id, { amount: 0, mode: "PENDING_APPROVAL" }) as { error?: string }).error), /reason/i);
  alerts.length = 0;
  reviews.length = 0;
  const r = await actions.staffCompleteJob(job.id, { amount: 0, mode: "PENDING_APPROVAL", note: "Customer will pay owner directly on Monday" });
  assert.equal(r.success, true);
  const j = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(j.status, "COMPLETED");
  assert.equal(j.collectedMode, "PENDING_APPROVAL");
  assert.match(j.pendingReason!, /Monday/);
  assert.equal((await db.payment.findFirstOrThrow({ where: { jobId: job.id } })).status, "PENDING");
  assert.ok(alerts.some((a) => a.kind === "OPS_ESCALATION" && a.critical && /PENDING APPROVAL/.test(a.title)));
  assert.equal(hasOutstandingBalance(await db.payment.findMany({ where: { jobId: job.id } })), true, "balance still open → the review request is held back");

  // …also for a job that never had a payment row: an open balance is created so the review cannot slip out
  const { job: bare } = await setup("E2");
  await actions.staffReachedLocation(bare.id, GOOD);
  await actions.staffVerifyStartOtp(bare.id, await otpOf(bare.id));
  await actions.addJobPhoto(bare.id, "AFTER", "/uploads/photos/e2.webp");
  await actions.staffCompleteJob(bare.id, { amount: 0, mode: "PENDING_APPROVAL", note: "Will pay after inspection" });
  const rows = await db.payment.findMany({ where: { jobId: bare.id } });
  assert.equal(rows.length, 1);
  assert.equal(hasOutstandingBalance(rows), true);
});

test("a partial collection leaves the balance open and does not trigger the review", async () => {
  const { job } = await setup("F");
  await db.payment.create({ data: { invoiceNumber: "FA-INV-F", jobId: job.id, clientName: "Asha", amount: 4000, paidAmount: 0, dueDate: new Date(), status: "PENDING" } as never });
  await actions.staffReachedLocation(job.id, GOOD);
  await actions.staffVerifyStartOtp(job.id, await otpOf(job.id));
  await actions.addJobPhoto(job.id, "AFTER", "/uploads/photos/f.webp");
  reviews.length = 0;
  await actions.staffCompleteJob(job.id, { amount: 1500, mode: "UPI" });
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
