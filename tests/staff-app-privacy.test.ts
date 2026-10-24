// Staff App privacy + sync contract (owner brief 2026-10-24, item 9). Run: npx tsx --test tests/staff-app-privacy.test.ts
// Staff see: customer name, full address, Google Maps link, date / slot, service scope. Staff never see: customer mobile, any amount.
// Synthetic data; throwaway DB.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-sp-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let portal: typeof import("../src/server/staff-portal");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  portal = await import("../src/server/staff-portal");
});
test.after(async () => { await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

const MOBILE = "9876501234";
const AMOUNT = 7321; // distinctive: must appear nowhere in staff data
const items = JSON.stringify([{ name: "Sofa Cleaning", qty: 5, unitPrice: 913, unit: "seat" }, { name: "Kitchen Deep Clean", qty: 1, unitPrice: 2756 }]);

test("an assigned job appears in the Staff App with name, address, map link, slot and scope - and no mobile number or amount anywhere", async () => {
  const staff = await db.staff.create({ data: { employeeCode: "SP-1", name: "Ravi", mobile: "9000000555", designation: "Cleaner", dailyWage: 733, salaryType: "DAILY" } as never });
  const me = { id: staff.id, name: "Ravi", employeeCode: "SP-1", designation: "Cleaner", mobile: "9000000555", photoUrl: null } as never;
  const job = await db.job.create({ data: { jobNumber: "SP-JOB-1", customerName: "Asha Rao", customerMobile: MOBILE, alternateMobile: "9876500099", address: "Flat 12, Sahara Heights, Kharadi, Pune 411014", pinCode: "411014", area: "Kharadi", mapLink: "https://maps.google.com/?q=18.55,73.94", service: "HOME_DEEP_CLEANING", serviceVariant: "3 BHK", packageName: "Platinum", serviceItems: items, scopeOfWork: "Kitchen deep clean\nBathroom scrub", notes: "Gate code 4455, customer phone is private", scheduledDate: new Date(), scheduledTime: "10:00 AM - 1:00 PM", jobValue: AMOUNT, discountAmount: 311, status: "ASSIGNED" } as never });
  assert.equal((await portal.getPortalHome(me)).todaysJobs.length, 0, "not assigned yet");
  await db.jobAssignment.create({ data: { jobId: job.id, staffId: staff.id, isLead: true } as never });
  await db.payment.create({ data: { jobId: job.id, clientName: "Asha", clientMobile: MOBILE, invoiceNumber: "SP-PAY-1", amount: AMOUNT, paidAmount: 1464, dueDate: new Date(), status: "PENDING" } as never });

  const home = await portal.getPortalHome(me);
  assert.deepEqual(home.todaysJobs.map((j) => j.jobNumber), ["SP-JOB-1"], "appears as soon as the crew is assigned");
  const h = home.todaysJobs[0];
  assert.deepEqual([h.customerName, h.address, h.mapLink, h.scheduledTime], ["Asha Rao", "Flat 12, Sahara Heights, Kharadi, Pune 411014", "https://maps.google.com/?q=18.55,73.94", "10:00 AM - 1:00 PM"]);

  const detail = await portal.getMyJob(staff.id, job.id);
  assert.ok(detail);
  assert.deepEqual([detail!.customerName, detail!.address, detail!.mapLink, detail!.scheduledTime], ["Asha Rao", "Flat 12, Sahara Heights, Kharadi, Pune 411014", "https://maps.google.com/?q=18.55,73.94", "10:00 AM - 1:00 PM"]);
  assert.match(String(detail!.scopeOfWork), /Kitchen deep clean/);
  assert.deepEqual([...detail!.packageServices].sort(), ["Kitchen Deep Clean", "Sofa Cleaning × 5"]); // names and quantities only

  // Random ids and the job's timestamp (random milliseconds) can contain a short amount like "311" by chance: blank them before the scan.
  const scrub = (t: string) => t.replace(/"(id|staffId)":"[^"]*"/g, '"$1":""').replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "");
  const everything = scrub(JSON.stringify({ home, detail }));
  for (const secret of [MOBILE, "9876500099", String(AMOUNT), "7,321", "913", "2756", "1464", "311"]) assert.ok(!everything.includes(secret), `${secret} must not reach the Staff App`);
  for (const key of ["customerMobile", "alternateMobile", "jobValue", "discountAmount", "unitPrice", "clientMobile", "paidAmount", "notes"]) assert.ok(!everything.includes(`"${key}"`), `field ${key} must not be sent to staff`);
});

test("another crew member's job is not reachable by id; a cancelled job disappears", async () => {
  const a = await db.staff.create({ data: { employeeCode: "SP-2", name: "Suresh", mobile: "9000000556", designation: "Cleaner", dailyWage: 700, salaryType: "DAILY" } as never });
  const job = await db.job.findFirstOrThrow({ where: { jobNumber: "SP-JOB-1" } });
  assert.equal(await portal.getMyJob(a.id, job.id), null, "not on this job's crew");
  const mine = await db.staff.findFirstOrThrow({ where: { employeeCode: "SP-1" } });
  await db.job.update({ where: { id: job.id }, data: { status: "CANCELLED" } });
  assert.equal(await portal.getMyJob(mine.id, job.id), null);
});
