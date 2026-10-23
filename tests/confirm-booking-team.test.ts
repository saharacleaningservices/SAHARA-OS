// Single-step Confirm Booking with a team (autonomous brief P4.1): team rosters shown inline, one save = job + team + crew.
// Run: npx tsx --test tests/confirm-booking-team.test.ts   Synthetic data; throwaway DB; WhatsApp not configured.
import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-cb-"));
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
let leads: typeof import("../src/server/actions/leads");
let roster: typeof import("../src/server/actions/team-roster");
let adminId = "";
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  leads = await import("../src/server/actions/leads");
  roster = await import("../src/server/actions/team-roster");
  adminId = (await db.user.create({ data: { name: "Altaf", email: "a@t.test", passwordHash: "x", role: "ADMIN" } })).id;
});
test.after(async () => { M._load = realLoad; await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

let n = 0;
const staff = (name: string, isActive = true) => db.staff.create({ data: { employeeCode: `E-${++n}`, name, mobile: `90000000${String(n).padStart(2, "0")}`, designation: "Cleaning Executive", isActive } as never });
const lead = () => db.lead.create({ data: { leadNumber: `L-${++n}`, name: "Asha Rao", mobile: "9811111111", area: "Baner", address: "Flat 2, Baner", service: "HOME_DEEP_CLEANING", source: "CALL", quoteAmount: 5000 } as never });
const tomorrow = () => new Date(Date.now() + 86400000 + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

test("rosters: each team shows the crew of its latest job (lead first, active only, names only); empty teams are empty; Field Staff get nothing", async () => {
  const rahul = await staff("Rahul");
  const ayesha = await staff("Ayesha");
  const gone = await staff("Left Company", false);
  const old = await db.job.create({ data: { jobNumber: "R-OLD", customerName: "x", customerMobile: "9800000001", address: "a", area: "a", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.now() - 20 * 86400000), scheduledTime: "10:00 AM", jobValue: 1, status: "COMPLETED", teamNumber: 1 } as never });
  await db.jobAssignment.createMany({ data: [{ jobId: old.id, staffId: gone.id, isLead: true }] });
  const recent = await db.job.create({ data: { jobNumber: "R-NEW", customerName: "x", customerMobile: "9800000002", address: "a", area: "a", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(Date.now() - 2 * 86400000), scheduledTime: "10:00 AM", jobValue: 1, status: "COMPLETED", teamNumber: 1 } as never });
  await db.jobAssignment.createMany({ data: [{ jobId: recent.id, staffId: ayesha.id, isLead: false }, { jobId: recent.id, staffId: rahul.id, isLead: true }, { jobId: recent.id, staffId: gone.id, isLead: false }] });

  session = { sub: adminId, name: "Altaf", email: "a@t.test", role: "ADMIN" };
  const r = await roster.getTeamRosters();
  assert.deepEqual(r.map((x) => x.team), [1, 2, 3, 4]);
  assert.deepEqual(r[0].crew.map((c) => c.name), ["Rahul", "Ayesha"]);
  assert.deepEqual(r[1].crew, []);
  assert.deepEqual(Object.keys(r[0].crew[0]).sort(), ["id", "name"]);
  session = { sub: "s", name: "Crew", email: "s@x", role: "STAFF" };
  assert.ok((await roster.getTeamRosters()).every((x) => x.crew.length === 0));
});

test("one save: confirms the booking, creates the job in that team, assigns the crew (first = lead) and keeps it Confirmed; inactive / unknown staff ignored; double confirm refused", async () => {
  session = { sub: adminId, name: "Altaf", email: "a@t.test", role: "ADMIN" };
  const rahul = await db.staff.findFirstOrThrow({ where: { name: "Rahul" } });
  const ayesha = await db.staff.findFirstOrThrow({ where: { name: "Ayesha" } });
  const gone = await db.staff.findFirstOrThrow({ where: { name: "Left Company" } });
  const l = await lead();
  const res = await leads.confirmBooking(l.id, { serviceDate: tomorrow(), timeSlot: "10:00 AM", teamNumber: 1, staffIds: [rahul.id, ayesha.id, gone.id, "nope"] });
  assert.equal((res as { success?: boolean }).success !== false && !(res as { error?: string }).error, true, JSON.stringify(res));
  const job = await db.job.findFirstOrThrow({ where: { leadId: l.id }, include: { assignments: true } });
  assert.deepEqual([job.teamNumber, job.status], [1, "ASSIGNED"]);
  assert.deepEqual(job.assignments.map((a) => [a.staffId, a.isLead]).sort(), [[rahul.id, true], [ayesha.id, false]].sort());
  assert.equal((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).stage, "JOB_SCHEDULED");
  assert.match(String((await leads.confirmBooking(l.id, { serviceDate: tomorrow(), timeSlot: "10:00 AM", teamNumber: 1, staffIds: [rahul.id] }) as { error?: string }).error), /already/i);
  assert.equal(await db.job.count({ where: { leadId: l.id } }), 1, "never two jobs");
});

test("without a team crew the old behaviour stays: no crew assigned, job stays Confirmed (ASSIGNED is the job default)", async () => {
  session = { sub: adminId, name: "Altaf", email: "a@t.test", role: "ADMIN" };
  const l = await lead();
  await leads.confirmBooking(l.id, { serviceDate: tomorrow(), timeSlot: "2:00 PM", teamNumber: 2 });
  const job = await db.job.findFirstOrThrow({ where: { leadId: l.id }, include: { assignments: true } });
  assert.deepEqual([job.teamNumber, job.assignments.length, job.status], [2, 0, "ASSIGNED"]);
});
