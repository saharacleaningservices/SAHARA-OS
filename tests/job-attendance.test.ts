import { test } from "node:test";
import assert from "node:assert/strict";
import { decideJobAttendance } from "../src/server/job-attendance";

const base = { jobStatus: "ASSIGNED", jobDayIst: "2026-11-08", todayIst: "2026-11-08", hasExistingRow: false };

test("confirmed job today with no row → MARK", () => {
  assert.equal(decideJobAttendance(base), "MARK");
});
test("past confirmed job → MARK (backfill)", () => {
  assert.equal(decideJobAttendance({ ...base, jobDayIst: "2026-11-01" }), "MARK");
});
test("existing row (e.g. office-set Absent/Leave) is never overwritten", () => {
  assert.equal(decideJobAttendance({ ...base, hasExistingRow: true }), "SKIP_EXISTING");
});
test("future job waits for its day", () => {
  assert.equal(decideJobAttendance({ ...base, jobDayIst: "2026-11-15" }), "SKIP_FUTURE");
});
test("future-dated job already started/completed is logged", () => {
  assert.equal(decideJobAttendance({ ...base, jobDayIst: "2026-11-15", jobStatus: "STARTED" }), "MARK");
});
test("PENDING / POSTPONED / CANCELLED never log attendance", () => {
  for (const s of ["PENDING", "POSTPONED", "CANCELLED"]) assert.equal(decideJobAttendance({ ...base, jobStatus: s }), "SKIP_STATUS");
});
