// Payroll Summary (owner 2026-11-06): header rename + dynamic month, custom staff priority order,
// ledger Edit/Correct with live Salary Due / Loan Outstanding, solid-red loan badge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { payrollSummaryTitle } from "../src/lib/payroll-period";
import { sortStaffByPriority, staffPriorityGroup, staffPriorityRank } from "../src/lib/staff-priority";
import { correctableTypeOf, previewCorrection } from "../src/lib/money-correction";

const read = (f: string) => readFileSync(f, "utf8");

test("header: Payroll Summary - <selected month> <year>", () => {
  assert.equal(payrollSummaryTitle(2026, 10), "Payroll Summary - October 2026");
  assert.equal(payrollSummaryTitle(2027, 1), "Payroll Summary - January 2027");
  const card = read("src/components/staff/staff-khata-card.tsx");
  assert.ok(!card.includes("</BookOpen> Money Khata") && !/size-4 text-primary" \/> Money Khata/.test(card), "visible label renamed");
  assert.ok(card.includes("{periodLabel}"));
  assert.ok(read("src/app/(app)/staff/[id]/page.tsx").includes("payrollSummaryTitle(calYear, calMonth)"));
});

test("staff order: groups 1→2→3 then daily wagers, never alphabetical", () => {
  const input = ["Abhishek", "Amir Sheikh", "Francis Montero", "Hk Kaleem", "Shoaib Kazi", "Ayesha Sheikh", "Giyasuddin", "Sariful Rehman", "Shama Sheikh", "Parveen Sheikh", "Sikandar Pathan", "Mahesh Banberu", "Bobby Waghmare"].map((name) => ({ name, employeeCode: null }));
  assert.deepEqual(
    sortStaffByPriority(input).map((s) => s.name),
    ["Mahesh Banberu", "Sikandar Pathan", "Sariful Rehman", "Giyasuddin", "Amir Sheikh", "Parveen Sheikh", "Shama Sheikh", "Ayesha Sheikh", "Shoaib Kazi", "Francis Montero", "Abhishek", "Bobby Waghmare", "Hk Kaleem"],
  );
});

test("staff order: CRM / Khata spelling variants resolve to the same slot", () => {
  assert.equal(staffPriorityRank("Mahesh Banbiru"), 1);
  assert.equal(staffPriorityRank("Hk Mahesh"), 1);
  assert.equal(staffPriorityRank("Shariful Rehman"), 3);
  assert.equal(staffPriorityRank("Giyashuddin"), 4);
  assert.equal(staffPriorityRank("Parvin Shaikh"), 6);
  assert.equal(staffPriorityRank("Shamma Shaikh"), 7);
  assert.equal(staffPriorityRank("Aayesha Shaikh"), 8);
  assert.equal(staffPriorityRank("Shoyab Kazi"), 9);
  assert.equal(staffPriorityRank("Fransis Montero"), 10);
  assert.equal(staffPriorityRank("Rehan Sheikh"), 100, "Rehan (rehan ≠ rehman) is not a named-priority staff");
  assert.deepEqual([1, 2, 3, 4].map((g) => g), [1, 2, 3, 4]);
  assert.equal(staffPriorityGroup("Amir Sheikh"), 1);
  assert.equal(staffPriorityGroup("Parveen Sheikh"), 2);
  assert.equal(staffPriorityGroup("Shoaib Kazi"), 3);
  assert.equal(staffPriorityGroup("Nilo Sheikh"), 4);
});

test("daily wagers keep employee-ID order after the named staff", () => {
  const out = sortStaffByPriority([
    { name: "Zed", employeeCode: "SCS-0012" },
    { name: "Amin", employeeCode: "SCS-0011" },
    { name: "Mahesh", employeeCode: "SCS-0099" },
  ]);
  assert.deepEqual(out.map((s) => s.name), ["Mahesh", "Amin", "Zed"]);
});

test("correction preview: Salary paid → Loan given moves money out of Salary Due paid and into the loan", () => {
  // Khata now: Salary Due 10,000 (a ₹8,000 'Salary paid' is already deducted), Loan 0.
  const p = previewCorrection({ salaryDue: 10000, loanRemaining: 0 }, { type: "SALARY", amount: 8000 }, { type: "LOAN", amount: 8000 });
  assert.equal(p.salaryDue, 18000, "salary paid no longer reduces Salary Due");
  assert.equal(p.loanRemaining, 8000);
  assert.equal(p.loanNegative, false);
});

test("correction preview: amount change, cancel, recovery guard", () => {
  assert.equal(previewCorrection({ salaryDue: 5000, loanRemaining: 0 }, { type: "SALARY", amount: 3000 }, { type: "SALARY", amount: 2000 }).salaryDue, 6000);
  assert.equal(previewCorrection({ salaryDue: 5000, loanRemaining: 0 }, { type: "ADVANCE", amount: 1000 }, null).salaryDue, 6000);
  const l = previewCorrection({ salaryDue: 5000, loanRemaining: 2000 }, { type: "LOAN_RECOVERY", amount: 500 }, { type: "LOAN", amount: 500 });
  assert.equal(l.loanRemaining, 3000, "recovery → loan given: +500 undone and +500 added");
  assert.equal(l.salaryDue, 5000, "loan entries never touch Salary Due");
  assert.equal(previewCorrection({ salaryDue: 0, loanRemaining: 1000 }, { type: "LOAN", amount: 1000 }, { type: "LOAN_RECOVERY", amount: 1000 }).loanNegative, true);
});

test("entry kinds that can switch type", () => {
  assert.equal(correctableTypeOf("SALARY_PAID"), "SALARY");
  assert.equal(correctableTypeOf("PAYMENT"), "SALARY");
  assert.equal(correctableTypeOf("ADVANCE"), "ADVANCE");
  assert.equal(correctableTypeOf("LOAN_GIVEN"), "LOAN");
  assert.equal(correctableTypeOf("LOAN_REPAID"), "LOAN_RECOVERY");
  assert.equal(correctableTypeOf("BONUS"), null);
  assert.equal(correctableTypeOf("AUTO_FARE"), null);
});

test("loan amounts are solid bold red #DC2626 in the CRM and the Staff App", () => {
  const card = read("src/components/staff/staff-khata-card.tsx");
  assert.ok(card.includes("text-[#DC2626]"));
  assert.ok(!/text-indigo-\d+ dark:text-indigo-\d+"\s*:\s*""/.test(card), "no indigo loan badge left");
  assert.ok(read("src/app/my/page.tsx").includes("bg-[#DC2626]"));
  assert.ok(read("src/app/my/records/page.tsx").includes("bg-[#DC2626]"));
});

test("ledger rows have an Edit / Correct dialog and the server accepts a type change", () => {
  const card = read("src/components/staff/staff-khata-card.tsx");
  assert.ok(card.includes("Edit / Correct") && card.includes("<Dialog"));
  const act = read("src/server/actions/staff-money.ts");
  assert.ok(act.includes("changeEntryType") && act.includes("CORRECTABLE_TYPES"));
});
