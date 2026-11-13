// Field Ops rules (owner brief 2026-11-13): GPS check-in, start OTP, completion gate, Live Field Ops read model, staff privacy.
// Run: npx tsx --test tests/field-ops.test.ts  — synthetic data, throwaway DB.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assessCheckIn, checkCompletion, coordsFromMapLink, distanceMetres, fieldStage, generateStartOtp, otpMatches, startOtpMessage, validateFix } from "../src/lib/field-ops";

const GOOD = { lat: 18.5535, lng: 73.9460, acc: 20 };

test("GPS: weak, fake, missing and out-of-India readings are rejected; a good fix passes", () => {
  assert.equal(validateFix(GOOD).ok, true);
  assert.equal(validateFix({ ...GOOD, acc: 150 }).ok, true, "exactly 150 m is allowed");
  assert.equal(validateFix({ ...GOOD, acc: 151 }).ok, false, "> 150 m rejected");
  assert.equal(validateFix({ lat: 0, lng: 0, acc: 10 }).ok, false, "0,0 is a mock-location signature");
  assert.equal(validateFix({ ...GOOD, acc: 0 }).ok, false, "zero accuracy is a mock-location signature");
  assert.equal(validateFix({ lat: 51.5, lng: -0.12, acc: 10 }).ok, false, "outside India");
  assert.equal(validateFix({ lat: NaN, lng: 73.9, acc: 10 }).ok, false);
  assert.equal(validateFix({ lat: 18.5, lng: 73.9 }).ok, false, "accuracy is mandatory");
  assert.equal(validateFix(null).ok, false);
  assert.equal(validateFix("18.5,73.9").ok, false);
});

test("Geofence: > 1.5 km from the pin → OUT_OF_ZONE; near → clean; no pin → NO_PIN (never silently 'verified')", () => {
  const pin = "https://maps.google.com/?q=18.55350,73.94600";
  assert.deepEqual(assessCheckIn({ ...GOOD }, pin), { distanceM: 0, flag: null });
  const near = assessCheckIn({ lat: 18.5600, lng: 73.9460, acc: 20 }, pin); // ~ 723 m
  assert.equal(near.flag, null);
  assert.ok(near.distanceM! > 700 && near.distanceM! < 750);
  const far = assessCheckIn({ lat: 18.5800, lng: 73.9460, acc: 20 }, pin); // ~ 2.8 km
  assert.equal(far.flag, "OUT_OF_ZONE");
  assert.ok(far.distanceM! > 1500);
  assert.deepEqual(assessCheckIn(GOOD, null), { distanceM: null, flag: "NO_PIN" });
  assert.deepEqual(assessCheckIn(GOOD, "https://maps.app.goo.gl/abc123"), { distanceM: null, flag: "NO_PIN" });
});

test("Map links: coordinates are read from q=, @ and destination= forms", () => {
  assert.deepEqual(coordsFromMapLink("https://www.google.com/maps/dir/?api=1&destination=18.55350,73.94600&travelmode=driving"), { lat: 18.5535, lng: 73.946 });
  assert.deepEqual(coordsFromMapLink("https://www.google.com/maps/@18.5535,73.9460,17z"), { lat: 18.5535, lng: 73.946 });
  assert.equal(coordsFromMapLink(""), null);
  assert.equal(coordsFromMapLink(undefined), null);
  assert.ok(Math.abs(distanceMetres({ lat: 18.5, lng: 73.9 }, { lat: 18.5, lng: 73.9 })) === 0);
});

test("Start OTP: always 4 digits, never a leading zero; only the exact code matches", () => {
  for (let i = 0; i < 500; i++) assert.match(generateStartOtp(), /^[1-9]\d{3}$/);
  assert.equal(otpMatches("4821", "4821"), true);
  assert.equal(otpMatches("4822", "4821"), false);
  assert.equal(otpMatches("482", "4821"), false);
  assert.equal(otpMatches("48211", "4821"), false);
  assert.equal(otpMatches(4821 as never, "4821"), false);
  assert.equal(otpMatches("4821", null), false);
  assert.match(startOtpMessage("Asha", "4821"), /\*4821\*/);
});

test("Completion gate: OTP, ≥1 after photo, exact amount and mode are all mandatory; Pending Approval needs a reason", () => {
  const ok = { amount: 3999, mode: "UPI", afterPhotos: 2, otpVerified: true, needsOtp: true };
  assert.deepEqual(checkCompletion(ok), { ok: true, amount: 3999, mode: "UPI", note: null });
  assert.equal(checkCompletion({ ...ok, otpVerified: false }).ok, false, "OTP not verified");
  assert.equal(checkCompletion({ ...ok, needsOtp: false, otpVerified: false }).ok, true, "legacy job without an OTP");
  assert.equal(checkCompletion({ ...ok, afterPhotos: 0 }).ok, false, "no photo");
  assert.equal(checkCompletion({ ...ok, mode: "" }).ok, false, "no mode");
  assert.equal(checkCompletion({ ...ok, mode: "CHEQUE" }).ok, false, "unknown mode");
  assert.equal(checkCompletion({ ...ok, amount: "" }).ok, false, "blank amount");
  assert.equal(checkCompletion({ ...ok, amount: -5 }).ok, false, "negative amount");
  assert.equal(checkCompletion({ ...ok, amount: 0 }).ok, false, "₹0 is not a payment");
  assert.equal(checkCompletion({ ...ok, mode: "PENDING_APPROVAL", amount: 0 }).ok, false, "pending needs a reason");
  assert.equal(checkCompletion({ ...ok, mode: "PENDING_APPROVAL", amount: 0, note: "abc" }).ok, false, "reason too short");
  assert.deepEqual(checkCompletion({ ...ok, mode: "PENDING_APPROVAL", amount: 0, note: "Customer will pay Monday" }), { ok: true, amount: 0, mode: "PENDING_APPROVAL", note: "Customer will pay Monday" });
  assert.equal(checkCompletion({ ...ok, mode: "CASH", amount: 1234.567 }).ok && (checkCompletion({ ...ok, mode: "CASH", amount: 1234.567 }) as { amount: number }).amount, 1234.57);
});

test("Live stage: Assigned → Reached → In Progress → Completed", () => {
  const t = new Date();
  assert.equal(fieldStage({ status: "ASSIGNED", reachedAt: null, startOtpVerifiedAt: null }), "ASSIGNED");
  assert.equal(fieldStage({ status: "ON_THE_WAY", reachedAt: null, startOtpVerifiedAt: null }), "ASSIGNED");
  assert.equal(fieldStage({ status: "ON_THE_WAY", reachedAt: t, startOtpVerifiedAt: null }), "REACHED");
  assert.equal(fieldStage({ status: "STARTED", reachedAt: t, startOtpVerifiedAt: t }), "IN_PROGRESS");
  assert.equal(fieldStage({ status: "COMPLETED", reachedAt: t, startOtpVerifiedAt: t }), "COMPLETED");
});

// ── database-backed: Live Field Ops read model + staff privacy of the new screen's data ──
const dir = mkdtempSync(path.join(tmpdir(), "sahara-fo-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });
let db: typeof import("../src/lib/db").db;
test.after(async () => { await db?.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("Live Field Ops lists today's jobs with stage, GPS flag and OTP backup; the OTP is hidden once work has started", async () => {
  db = (await import("../src/lib/db")).db;
  const portal = await import("../src/server/staff-portal");
  const ops = await import("../src/server/field-ops");
  const staff = await db.staff.create({ data: { employeeCode: "FO-1", name: "Ravi", mobile: "9000000777", designation: "Cleaner", dailyWage: 700, salaryType: "DAILY" } as never });
  const base = { customerName: "Asha Rao", customerMobile: "9876501999", address: "Flat 1, Kharadi", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 5555, mapLink: "https://maps.google.com/?q=18.55350,73.94600" };
  const a = await db.job.create({ data: { ...base, jobNumber: "FO-JOB-1", status: "ON_THE_WAY", reachedAt: new Date(), reachedLat: 18.58, reachedLng: 73.946, reachedAccuracyM: 30, reachedDistanceM: 2800, gpsFlag: "OUT_OF_ZONE", startOtp: "4821", startOtpSentAt: new Date() } as never });
  const b = await db.job.create({ data: { ...base, jobNumber: "FO-JOB-2", status: "STARTED", reachedAt: new Date(), startOtp: "7391", startOtpVerifiedAt: new Date(), startedAt: new Date() } as never });
  await db.job.create({ data: { ...base, jobNumber: "FO-JOB-3", status: "CANCELLED" } as never });
  await db.jobAssignment.create({ data: { jobId: a.id, staffId: staff.id, isLead: true } as never });
  await db.photo.create({ data: { jobId: b.id, type: "AFTER", url: "/uploads/photos/x.webp" } as never });

  const rows = await ops.getFieldOps();
  assert.deepEqual(rows.map((r) => r.jobNumber).sort(), ["FO-JOB-1", "FO-JOB-2"], "cancelled jobs are not listed");
  const r1 = rows.find((r) => r.jobNumber === "FO-JOB-1")!;
  const r2 = rows.find((r) => r.jobNumber === "FO-JOB-2")!;
  assert.equal(r1.stage, "REACHED");
  assert.equal(r1.gpsFlag, "OUT_OF_ZONE");
  assert.equal(r1.startOtp, "4821", "office sees the backup code before work starts");
  assert.deepEqual(r1.team, [{ name: "Ravi", isLead: true }]);
  assert.equal(r2.stage, "IN_PROGRESS");
  assert.equal(r2.startOtp, null, "code hidden once verified");
  assert.equal(r2.afterPhotos.length, 1);
  assert.ok(r1.mapHref?.includes("18.58000,73.94600"));

  // Staff-side data: no mobile number, never the OTP; billed amount only while the job is being worked on.
  await db.jobAssignment.create({ data: { jobId: b.id, staffId: staff.id, isLead: true } as never });
  const f1 = await portal.getMyJobField(staff.id, a.id);
  const f2 = await portal.getMyJobField(staff.id, b.id);
  assert.deepEqual(f1, { reached: true, otpVerified: false, afterPhotos: 0, billedAmount: 5555 });
  assert.deepEqual(f2, { reached: true, otpVerified: true, afterPhotos: 1, billedAmount: 5555 });
  const blob = JSON.stringify({ f1, f2, detail: await portal.getMyJob(staff.id, a.id) });
  for (const secret of ["9876501999", "4821", "7391"]) assert.ok(!blob.includes(secret), `${secret} must not reach the Staff App`);
  assert.equal(await portal.getMyJobField("someone-else", a.id), null, "another staff member cannot read this job's field state");
});
