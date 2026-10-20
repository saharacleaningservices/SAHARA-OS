import { test } from "node:test";
import assert from "node:assert/strict";
import { unassignedWithin, alertText } from "../src/server/team-alerts";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const job = (jobNumber: string, date: string, crewCount: number, status = "ASSIGNED") => ({ jobNumber, status, scheduledDate: d(date), scheduledTime: "10:00 AM", crewCount });

test("flags only open jobs with no crew inside today..+3 days, soonest first", () => {
  const out = unassignedWithin(
    [job("J3", "2026-10-23", 0), job("J1", "2026-10-20", 0), job("J2", "2026-10-21", 2), job("J4", "2026-10-25", 0), job("J5", "2026-10-19", 0), job("J6", "2026-10-21", 0, "CANCELLED"), job("J7", "2026-10-22", 0, "COMPLETED")],
    "2026-10-20",
  );
  assert.deepEqual(out.map((j) => [j.jobNumber, j.daysAway]), [["J1", 0], ["J3", 3]]);
});

test("alert text lists job ids and when, never amounts or contacts", () => {
  const t = alertText(unassignedWithin([job("JOB-2026-0269", "2026-10-21", 0), job("JOB-2026-0268", "2026-10-22", 0)], "2026-10-20"));
  assert.equal(t.title, "2 upcoming jobs have no team assigned");
  assert.match(t.body, /JOB-2026-0269 tomorrow 10:00 AM/);
  assert.match(t.body, /JOB-2026-0268 in 2 days/);
  assert.doesNotMatch(t.body, /₹|\+91|\d{10}/);
});

test("long lists are capped with a +N more suffix", () => {
  const many = Array.from({ length: 12 }, (_, i) => job(`J${String(i).padStart(2, "0")}`, "2026-10-21", 0));
  assert.match(alertText(unassignedWithin(many, "2026-10-20")).body, /\+4 more/);
});
