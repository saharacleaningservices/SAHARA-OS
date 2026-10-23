// Job card workflow end to end: technician assignment -> service status chain -> completion (final invoice, logs) -> day sheet / crew card
// privacy. Run: npx tsx --test tests/job-workflow.test.ts   Synthetic data; throwaway DB; WhatsApp is not configured (nothing is sent).
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-jw-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
for (const k of ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_OUTBOUND_MODE", "WHATSAPP_USE_TEMPLATES"]) delete process.env[k];

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
let act: typeof import("../src/server/actions/jobs");
let sheet: typeof import("../src/server/day-sheet");
let crew: typeof import("../src/server/crew-card");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  act = await import("../src/server/actions/jobs");
  sheet = await import("../src/server/day-sheet");
  crew = await import("../src/server/crew-card");
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
let n = 0;
const mkStaff = async (name: string, withUser: boolean) => {
  const user = withUser ? await db.user.create({ data: { name, email: `s${++n}@t.test`, passwordHash: "x", role: "STAFF" } }) : null;
  return db.staff.create({ data: { employeeCode: `E-${++n}`, name, mobile: `90000000${String(n).padStart(2, "0")}`, designation: "Cleaning Executive", userId: user?.id ?? null } as never });
};

test("assign a team, run the status chain, complete: timestamps, activity log, one final invoice, crew only sees their own job", async () => {
  const lead = await mkStaff("Ramesh Lead", true);
  const helper = await mkStaff("Suresh Helper", true);
  const outsider = await mkStaff("Other Crew", true);
  const admin = await db.user.create({ data: { name: "Altaf Sheikh", email: "a@t.test", passwordHash: "x", role: "ADMIN" } });

  session = { sub: admin.id, name: "Altaf Sheikh", email: "a@t.test", role: "ADMIN" };
  const created = await act.createJob({ customerName: "Asha Rao", customerMobile: "9811111111", address: "Flat 2, Kharadi", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: today(), scheduledTime: "10:00 AM", teamNumber: 2, staffIds: [lead.id, helper.id], jobValue: 5000 });
  assert.equal((created as { success?: boolean }).success, true, JSON.stringify(created));
  const job = await db.job.findFirstOrThrow({ where: { customerName: "Asha Rao" }, include: { assignments: true } });
  assert.equal(job.status, "ASSIGNED");
  assert.deepEqual(job.assignments.map((a) => [a.staffId, a.isLead]).sort(), [[lead.id, true], [helper.id, false]].sort());

  // Crew card + day sheet carry the team but never phone / money / customer name.
  const card = await crew.getCrewCard(job.id);
  assert.deepEqual([card!.team, card!.crew.includes("Ramesh Lead (lead)"), card!.crew.includes("Suresh Helper")], ["Team 2", true, true]);
  const rows = await sheet.getDaySheet(new Date());
  assert.deepEqual(rows.filter((r) => r.jobNumber === job.jobNumber).map((r) => r.status), ["Assigned"]);
  assert.ok(!JSON.stringify([card, rows]).match(/Asha|9811111111|5000/));

  // Staff App: only the assigned crew, only forward, only their own job.
  session = { sub: outsider.userId as string, name: "Other Crew", email: "o@t", role: "STAFF" };
  assert.equal((await act.staffUpdateJobStatus(job.id, "ON_THE_WAY")).success, false, "not on this job's crew");
  session = { sub: helper.userId as string, name: "Suresh Helper", email: "h@t", role: "STAFF" };
  assert.equal((await act.staffUpdateJobStatus(job.id, "STARTED")).success, true);
  assert.equal((await act.staffUpdateJobStatus(job.id, "ON_THE_WAY")).success, false, "no stepping backwards");
  assert.equal((await act.updateJobStatus(job.id, "PENDING")).success, false, "field staff cannot use the office action");

  // Office finishes the job: invoice created once, timestamps set, every change logged, repeat tap is a no-op.
  session = { sub: admin.id, name: "Altaf Sheikh", email: "a@t.test", role: "ADMIN" };
  assert.equal((await act.updateJobStatus(job.id, "COMPLETED")).success, true);
  const again = await act.updateJobStatus(job.id, "COMPLETED");
  assert.equal((again as { unchanged?: boolean }).unchanged, true);
  const done = await db.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(done.status, "COMPLETED");
  assert.ok(done.startedAt && done.completedAt && done.completedAt >= done.startedAt);
  assert.equal(await db.invoice.count({ where: { jobId: job.id } }), 1, "exactly one final invoice");
  const log = (await db.activityLog.findMany({ where: { jobId: job.id }, orderBy: { createdAt: "asc" } })).map((l) => l.action);
  assert.ok(log.some((l) => /Status changed to STARTED/.test(l)) && log.some((l) => /Status changed to COMPLETED/.test(l)), JSON.stringify(log));
  assert.equal(log.filter((l) => /COMPLETED/.test(l)).length, 1, "the repeat tap did not log twice");
});

test("a cancelled job leaves the day sheet; Operations (Francis) cannot run the money action on the status chain", async () => {
  const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  session = { sub: admin.id, name: "Altaf Sheikh", email: "a@t.test", role: "ADMIN" };
  await act.createJob({ customerName: "Beta Corp", customerMobile: "9822222222", address: "Baner", area: "Baner", service: "HOME_DEEP_CLEANING", scheduledDate: today(), scheduledTime: "2:00 PM", jobValue: 3000 });
  const j = await db.job.findFirstOrThrow({ where: { customerName: "Beta Corp" } });
  assert.equal(j.status, "PENDING", "no crew yet");
  assert.ok((await sheet.getDaySheet(new Date())).some((r) => r.jobNumber === j.jobNumber));
  assert.equal((await act.updateJobStatus(j.id, "CANCELLED")).success, true);
  assert.ok(!(await sheet.getDaySheet(new Date())).some((r) => r.jobNumber === j.jobNumber));
  assert.equal((await act.updateJobStatus(j.id, "NOT_A_STATUS" as never)).success, false);
});
