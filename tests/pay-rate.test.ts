import { test } from "node:test";
import assert from "node:assert/strict";
import { daysInMonthIst, perDayRate } from "../src/lib/pay-rate";

const d = (iso: string) => new Date(`${iso}T12:00:00+05:30`);
test("days in month, IST", () => {
  assert.equal(daysInMonthIst(d("2026-09-15")), 30);
  assert.equal(daysInMonthIst(d("2026-10-15")), 31);
  assert.equal(daysInMonthIst(d("2026-02-10")), 28);
  assert.equal(daysInMonthIst(d("2028-02-10")), 29);
  assert.equal(daysInMonthIst(new Date("2026-09-30T20:00:00Z")), 31); // already 1 Oct in IST
});
test("daily wager: rate × days, no month division (Ameen Pathan ₹650)", () => {
  const ameen = { salaryType: "DAILY", dailyWage: 650, monthlySalary: null };
  assert.equal(perDayRate(ameen, d("2026-10-01")), 650);
  assert.equal(perDayRate(ameen, d("2026-10-01")) * 28, 18200);
});
test("monthly staff: salary ÷ days of that month", () => {
  const s = { salaryType: "MONTHLY", dailyWage: null, monthlySalary: 18600 };
  assert.equal(perDayRate(s, d("2026-10-05")), 600); // 31-day month
  assert.equal(perDayRate(s, d("2026-09-05")), 620); // 30-day month
});

import { EMPLOYEE_ID_MASTER } from "../src/server/employee-id-master";
test("SCS-0009 is only Ameen Pathan (owner 2026-11-06)", () => {
  const e = EMPLOYEE_ID_MASTER.filter((x) => x.code === "SCS-0009");
  assert.equal(e.length, 1);
  assert.equal(e[0].name, "Ameen Pathan");
  assert.equal(EMPLOYEE_ID_MASTER.filter((x) => /ameen|amin/i.test(x.name)).length, 1);
});
