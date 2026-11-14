// Field Ops rules (owner brief 2026-11-13): GPS check-in, start OTP, completion gate, Live Field Ops read model, staff privacy.
// Run: npx tsx --test tests/field-ops.test.ts  — synthetic data, throwaway DB.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { assessCheckIn, billSummary, canManageTracking, canOfficeClose, canViewGps, cashWithStaffLabel, gpsMapScope, gpsSubjectOf, isOnShift, latestVisibleLocations, LIVE_JOB_STATUSES, locationPingWhere, MIN_PING_GAP_MS, PING_EVERY_MS, resolvePingTarget, startOtpTemplatePayload, checkCompletion, coordsFromMapLink, distanceMetres, fieldStage, generateStartOtp, otpMatches, startOtpMessage, validateFix } from "../src/lib/field-ops";

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

test("Completion gate (payment confirmation only, no photos): OTP, exact amount and mode are all mandatory; Pending Approval needs a reason", () => {
  const ok = { amount: 3999, mode: "UPI", otpVerified: true, needsOtp: true };
  assert.deepEqual(checkCompletion(ok), { ok: true, amount: 3999, mode: "UPI", note: null });
  assert.equal(checkCompletion({ ...ok, otpVerified: false }).ok, false, "OTP not verified");
  assert.equal(checkCompletion({ ...ok, needsOtp: false, otpVerified: false }).ok, true, "legacy job without an OTP");
  assert.equal(checkCompletion({ ...ok, afterPhotos: 0 } as never).ok, true, "photos are not part of the gate any more");
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

test("Bill split: total, advance (payments already received) and balance", () => {
  assert.deepEqual(billSummary(5000, [{ paidAmount: 1500 }, { paidAmount: 500 }]), { total: 5000, advance: 2000, balance: 3000 });
  assert.deepEqual(billSummary(5000, []), { total: 5000, advance: 0, balance: 5000 });
  assert.deepEqual(billSummary(5000, [{ paidAmount: 9000 }]), { total: 5000, advance: 5000, balance: 0 }, "never a negative balance");
});

test("GPS map visibility (owner 2026-11-14): Super Admin sees everyone; Shoaib and Francis only active field staff; staff none", () => {
  const field = { staffId: "t1", type: "FIELD" as const };
  const fieldOff = { staffId: "t2", type: "FIELD" as const, active: false };
  const francis = { staffId: "f", type: "SUPERVISOR" as const };
  const shoaib = { staffId: "s", type: "SUPERVISOR" as const };
  const altaf = { staffId: "a", type: gpsSubjectOf({ userRole: "ADMIN" }) };
  for (const subj of [field, fieldOff, francis, shoaib, altaf]) assert.equal(canViewGps({ role: "ADMIN" }, subj), true, "Super Admin sees all");
  assert.equal(canViewGps({ role: "ACCOUNTS", staffId: "s" }, field), true, "Shoaib sees an active technician");
  assert.equal(canViewGps({ role: "ACCOUNTS", staffId: "s" }, { ...field, active: true }), true);
  assert.equal(canViewGps({ role: "ACCOUNTS", staffId: "s" }, fieldOff), false, "…not an off-shift technician");
  assert.equal(canViewGps({ role: "ACCOUNTS", staffId: "s" }, francis), false, "…never Francis / office");
  assert.equal(canViewGps({ role: "ACCOUNTS", staffId: "s" }, shoaib), false, "…never himself");
  assert.equal(canViewGps({ role: "ACCOUNTS", staffId: "s" }, altaf), false, "…never the Super Admin");
  for (const role of ["OPERATIONS", "SUPERVISOR"]) {
    assert.equal(canViewGps({ role, staffId: "x" }, field), true, `${role} sees an active technician`);
    for (const subj of [fieldOff, francis, shoaib, altaf]) assert.equal(canViewGps({ role, staffId: "x" }, subj), false, `${role} never sees office / off-shift people`);
  }
  for (const role of ["STAFF", "NOPE"]) {
    for (const subj of [field, francis, altaf]) assert.equal(canViewGps({ role, staffId: "x" }, subj), false, `${role} gets no map`);
  }
  assert.equal(gpsMapScope("ADMIN"), "ALL");
  assert.equal(gpsMapScope("ACCOUNTS"), "ACTIVE_FIELD");
  for (const r of ["OPERATIONS", "SUPERVISOR"]) assert.equal(gpsMapScope(r), "ACTIVE_FIELD", r);
  for (const r of ["STAFF", null, undefined]) assert.equal(gpsMapScope(r as never), null, String(r));
  for (const r of ["ADMIN", "OPERATIONS", "ACCOUNTS", "SUPERVISOR"]) assert.equal(gpsSubjectOf({ userRole: r }), "SUPERVISOR", r);
  for (const d of ["Supervisor", "Operations Manager", "Field Coordinator", "Accountant", "Accounts", "Office Staff", "Owner", "Super Admin"]) assert.equal(gpsSubjectOf({ userRole: "STAFF", designation: d }), "SUPERVISOR", d);
  for (const d of ["Cleaner", "Cleaning Executive", "Painter", "Pest Control Technician", "Helper"]) assert.equal(gpsSubjectOf({ userRole: "STAFF", designation: d }), "FIELD", d);
});

test("locationPingWhere enforces the scope in the query: Shoaib's rows are FIELD + active staff ids only; no scope → null", () => {
  const since = new Date("2026-11-13T18:30:00Z");
  assert.deepEqual(locationPingWhere("ALL", ["t1"], since), { createdAt: { gte: since } });
  assert.deepEqual(locationPingWhere("ACTIVE_FIELD", ["t1", "user:u9"], since), { createdAt: { gte: since }, subjectType: "FIELD", staffId: { in: ["t1"] } });
  assert.equal(locationPingWhere(null, ["t1"], since), null);
});

test("latestVisibleLocations: newest ping per person, re-checks the CURRENT role, hides office and inactive people from Shoaib", () => {
  const t = (m: number) => new Date(Date.UTC(2026, 10, 14, 5, m));
  const row = (staffId: string, m: number, subjectType = "FIELD") => ({ staffId, staffName: staffId, jobId: null, kind: "PING", lat: 18.5, lng: 73.9, accuracyM: 20, subjectType, createdAt: t(m) });
  const rows = [row("t1", 1), row("t1", 9), row("t2", 3), row("promoted", 4), row("f", 5, "SUPERVISOR"), row("user:u1", 6, "SUPERVISOR"), row("off", 7)];
  const current = new Map([["t1", "FIELD"], ["t2", "FIELD"], ["promoted", "SUPERVISOR"], ["f", "SUPERVISOR"], ["off", "FIELD"]] as const);
  const active = new Set(["t1", "t2", "promoted"]);
  const shoaib = latestVisibleLocations({ role: "ACCOUNTS", staffId: "s" }, rows, current, active);
  assert.deepEqual(shoaib.map((r) => r.staffId).sort(), ["t1", "t2"]);
  const t1 = shoaib.find((r) => r.staffId === "t1")!;
  assert.equal(t1.createdAt.getTime(), t(9).getTime(), "latest fix wins");
  assert.equal(t1.pings, 2);
  const admin = latestVisibleLocations({ role: "ADMIN" }, rows, current, active);
  assert.deepEqual(admin.map((r) => r.staffId).sort(), ["f", "off", "promoted", "t1", "t2", "user:u1"]);
  assert.equal(admin.find((r) => r.staffId === "user:u1")!.type, "SUPERVISOR");
  assert.deepEqual(latestVisibleLocations({ role: "OPERATIONS", staffId: "f" }, rows, current, active).map((r) => r.staffId).sort(), ["t1", "t2"], "Francis: active technicians only");
  assert.deepEqual(latestVisibleLocations({ role: "STAFF", staffId: "t1" }, rows, current, active), []);
});

test("continuous pings: target resolution covers live job (on the way → reached → in progress) and checked-in shift", () => {
  const base = { office: false, requestedJobId: null, requestedJobLive: false, ownLiveJobId: null, onShift: false };
  assert.deepEqual(resolvePingTarget(base), { ok: false, reason: "no-active-job" });
  assert.deepEqual(resolvePingTarget({ ...base, ownLiveJobId: "j1" }), { ok: true, jobId: "j1" }, "page-independent: server finds the live job");
  assert.deepEqual(resolvePingTarget({ ...base, requestedJobId: "j2", requestedJobLive: true, ownLiveJobId: "j1" }), { ok: true, jobId: "j2" });
  assert.deepEqual(resolvePingTarget({ ...base, requestedJobId: "j2", requestedJobLive: false }), { ok: false, reason: "no-active-job" }, "a finished job stops pinging");
  assert.deepEqual(resolvePingTarget({ ...base, onShift: true }), { ok: true, jobId: null }, "checked in for the shift, between jobs");
  assert.deepEqual(resolvePingTarget({ ...base, office: true }), { ok: true, jobId: null });
  assert.deepEqual([...LIVE_JOB_STATUSES], ["ON_THE_WAY", "STARTED"]);
  const day = new Date("2026-11-13T18:30:00Z");
  assert.equal(isOnShift({ checkInTime: new Date("2026-11-14T03:00:00Z"), checkOutTime: null }, day), true);
  assert.equal(isOnShift({ checkInTime: new Date("2026-11-14T03:00:00Z"), checkOutTime: new Date("2026-11-14T12:00:00Z") }, day), false, "checked out");
  assert.equal(isOnShift({ checkInTime: new Date("2026-11-13T03:00:00Z"), checkOutTime: null }, day), false, "yesterday's check-in");
  assert.equal(isOnShift(null, day), false);
  assert.ok(PING_EVERY_MS > MIN_PING_GAP_MS, "client cadence is never refused by the server rate limit");
});

test("the pinger is mounted once per app shell (whole shift), re-pings on return to foreground, and asks the server first", () => {
  const pinger = readFileSync("src/components/staff-app/location-pinger.tsx", "utf8");
  assert.match(pinger, /setInterval\(/);
  assert.match(pinger, /visibilitychange/);
  assert.match(pinger, /getLocationPingStatus\(\)/);
  assert.match(pinger, /const PING_EVERY_MS = 3 \* 60_000/);
  assert.match(readFileSync("src/app/my/layout.tsx", "utf8"), /<LocationPinger \/>/);
  assert.ok(!readFileSync("src/app/my/jobs/[id]/page.tsx", "utf8").includes("LocationPinger"), "no longer limited to one job page");
});

test("Permissions: only Super Admin manages tracking; Admin, Francis and Shoaib may close jobs; staff may not", () => {
  assert.equal(canManageTracking("ADMIN"), true);
  for (const r of ["OPERATIONS", "ACCOUNTS", "SUPERVISOR", "STAFF", null, undefined]) assert.equal(canManageTracking(r as never), false, String(r));
  for (const r of ["ADMIN", "OPERATIONS", "ACCOUNTS"]) assert.equal(canOfficeClose(r), true, r);
  for (const r of ["SUPERVISOR", "STAFF", null]) assert.equal(canOfficeClose(r as never), false, String(r));
});

test("Cash alert label and the sahara_start_otp_v1 template payload", () => {
  assert.equal(cashWithStaffLabel("Ravi", 4000), "[CASH WITH STAFF: Ravi — ₹4,000]");
  const t = startOtpTemplatePayload("Asha", "4821");
  assert.equal(t.templateName, "sahara_start_otp_v1");
  assert.deepEqual(t.bodyParams, ["Asha", "4821"]);
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

  const rows = await ops.getFieldOps({ role: "ADMIN" });
  assert.deepEqual(rows.map((r) => r.jobNumber).sort(), ["FO-JOB-1", "FO-JOB-2"], "cancelled jobs are not listed");
  const r1 = rows.find((r) => r.jobNumber === "FO-JOB-1")!;
  const r2 = rows.find((r) => r.jobNumber === "FO-JOB-2")!;
  assert.equal(r1.stage, "REACHED");
  assert.equal(r1.gpsFlag, "OUT_OF_ZONE");
  assert.equal(r1.startOtp, "4821", "office sees the backup code before work starts");
  assert.deepEqual(r1.team, [{ name: "Ravi", isLead: true }]);
  assert.equal(r2.stage, "IN_PROGRESS");
  assert.equal(r2.startOtp, null, "code hidden once verified");
  assert.ok(r1.mapHref?.includes("18.58000,73.94600"));

  // Staff-side data: no mobile number, never the OTP; billed amount only while the job is being worked on.
  await db.jobAssignment.create({ data: { jobId: b.id, staffId: staff.id, isLead: true } as never });
  const f1 = await portal.getMyJobField(staff.id, a.id);
  const f2 = await portal.getMyJobField(staff.id, b.id);
  assert.deepEqual(f1, { reached: true, otpVerified: false, bill: { total: 5555, advance: 0, balance: 5555 } });
  assert.deepEqual(f2, { reached: true, otpVerified: true, bill: { total: 5555, advance: 0, balance: 5555 } });
  const blob = JSON.stringify({ f1, f2, detail: await portal.getMyJob(staff.id, a.id) });
  for (const secret of ["9876501999", "4821", "7391"]) assert.ok(!blob.includes(secret), `${secret} must not reach the Staff App`);
  assert.equal(await portal.getMyJobField("someone-else", a.id), null, "another staff member cannot read this job's field state");
});

test("LocationPing log is immutable (DB triggers refuse UPDATE and DELETE) and /field-ops hides GPS from supervisors", async () => {
  db = (await import("../src/lib/db")).db;
  const ops = await import("../src/server/field-ops");
  const mk = async (code: string, role: string | null, designation: string) => {
    const user = role ? await db.user.create({ data: { name: code, email: `${code}@x.test`, passwordHash: "x", role } as never }) : null;
    return db.staff.create({ data: { employeeCode: code, name: code, mobile: "9000000" + code.length, designation, dailyWage: 700, salaryType: "DAILY", userId: user?.id } as never });
  };
  const tech = await mk("TECH", "STAFF", "Cleaner");
  const francis = await mk("FRANCIS", "OPERATIONS", "Operations Manager");
  const base = { customerName: "X", customerMobile: "9876500000", address: "A", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(), scheduledTime: "10:00 AM", jobValue: 1000, status: "ON_THE_WAY", reachedAt: new Date(), reachedLat: 18.5, reachedLng: 73.9, reachedDistanceM: 10, mapLink: "https://maps.google.com/?q=18.5,73.9" };
  const jt = await db.job.create({ data: { ...base, jobNumber: "GPS-T" } as never });
  const jf = await db.job.create({ data: { ...base, jobNumber: "GPS-F" } as never });
  await db.jobAssignment.create({ data: { jobId: jt.id, staffId: tech.id, isLead: true } as never });
  await db.jobAssignment.create({ data: { jobId: jf.id, staffId: francis.id, isLead: true } as never });

  const shoaib = await mk("SHOAIB", "ACCOUNTS", "Accounts & Enquiry");
  const asAdmin = await ops.getFieldOps({ role: "ADMIN" });
  const asFrancis = await ops.getFieldOps({ role: "OPERATIONS", staffId: francis.id });
  const asShoaib = await ops.getFieldOps({ role: "ACCOUNTS", staffId: shoaib.id });
  assert.ok(asAdmin.find((r) => r.jobNumber === "GPS-F")!.mapHref, "Super Admin sees a supervisor's pin");
  assert.ok(asShoaib.find((r) => r.jobNumber === "GPS-T")!.mapHref, "Shoaib sees a technician's check-in pin");
  assert.equal(asShoaib.find((r) => r.jobNumber === "GPS-F")!.mapHref, null, "Shoaib never sees an office person's pin");
  assert.ok(asFrancis.find((r) => r.jobNumber === "GPS-T")!.mapHref, "Francis (OPERATIONS) sees a technician's pin (owner 2026-11-14)");
  assert.equal(asFrancis.find((r) => r.jobNumber === "GPS-F")!.gpsVisible, false, "…but never an office person's");

  const ping = await db.locationPing.create({ data: { staffId: tech.id, staffName: "TECH", kind: "PING", lat: 18.5, lng: 73.9, subjectType: "FIELD" } });
  await assert.rejects(() => db.locationPing.update({ where: { id: ping.id }, data: { lat: 1 } }));
  await assert.rejects(() => db.locationPing.delete({ where: { id: ping.id } }));
  await assert.rejects(() => db.locationPing.deleteMany({}));
  assert.equal((await db.locationPing.findUniqueOrThrow({ where: { id: ping.id } })).lat, 18.5);
  assert.equal(await db.locationPing.count(), 1);
});
