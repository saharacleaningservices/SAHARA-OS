// Management Export — month / year Excel workbook for Super Admin + Accounts.
//
// Built read-only from the live CRM tables (single source of truth); nothing
// is copied or stored. Demo and soft-deleted rows are excluded since this is
// a period accounting export (the owner's full-continuity export, which keeps
// deleted rows flagged, lives in src/server/business-export.ts).
//
// Definitions (reuse the existing CRM rules — no new ledgers):
//  - Sales            = CRM invoices issued in the period (excl. cancelled).
//  - Revenue          = payments received: Payment.paidAmount with status PAID
//                       by paidDate — the same rule as the Profit dashboard
//                       (src/server/profit.ts), so the two always agree.
//  - Expenses         = every Expense entry in the period, all categories
//                       (salary paid, rent, vendor, fuel/auto, repairs, …).
//  - Purchase         = the manual purchase entries inside Expenses
//                       (PURCHASE_EXPENSE_CATEGORIES). Shown separately for
//                       visibility; already included in Total Expenses.
//  - Net / Balance    = Revenue − Total Expenses (Profit dashboard rule).
//  - Team incentives  = one ₹ total per job + team (never split per person).
//
// Every sheet is one bulk range query (+ in-memory grouping), so a full year
// for 100+ staff stays a fixed ~12 queries.

import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { SERVICE_LABELS, COMPANY, EXPENSE_CATEGORY_LABELS, PURCHASE_EXPENSE_CATEGORIES } from "@/lib/constants";
import { computeEarned } from "@/server/attendance";

export type ExportPeriod = { year: number; month: number | null };

export function periodRange({ year, month }: ExportPeriod) {
  const from = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const to = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);
  const label = month
    ? new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : `Year ${year}`;
  return { from, to, label };
}

const d = (x: Date | null | undefined) =>
  x ? `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}` : "";
const r2 = (n: number) => Math.round(n * 100) / 100;
const ym = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
const isPurchase = (c: string) => (PURCHASE_EXPENSE_CATEGORIES as readonly string[]).includes(c);

function group<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}
const sum = (rows: { amount: number }[] | undefined) => (rows ?? []).reduce((s, r) => s + r.amount, 0);

function teamNames(teamSnapshot: string | null, assignments: { isLead: boolean; staff: { name: string } }[]) {
  if (teamSnapshot) {
    try {
      return (JSON.parse(teamSnapshot) as { name: string; isLead?: boolean }[]).map((m) => (m.isLead ? `${m.name} (Lead)` : m.name)).join(", ");
    } catch {
      /* fall through */
    }
  }
  return assignments.map((a) => (a.isLead ? `${a.staff.name} (Lead)` : a.staff.name)).join(", ");
}

export async function buildPeriodWorkbook(period: ExportPeriod): Promise<{ buffer: Buffer; filename: string }> {
  const { from, to, label } = periodRange(period);
  const range = { gte: from, lt: to };

  const [invoices, revenueRows, expenses, staff, attendance, advances, fines, rewards, jobs, incentives] = await Promise.all([
    db.invoice.findMany({ where: { createdAt: range }, orderBy: { createdAt: "asc" }, include: { job: { select: { jobNumber: true, service: true } } } }),
    db.payment.findMany({
      where: { paidDate: range, deletedAt: null, isDemo: false, status: "PAID" },
      orderBy: { paidDate: "asc" },
      include: { job: { select: { jobNumber: true } } },
    }),
    db.expense.findMany({
      where: { date: range, deletedAt: null, isDemo: false },
      orderBy: { date: "asc" },
      include: { staff: { select: { name: true, employeeCode: true } }, job: { select: { jobNumber: true } } },
    }),
    db.staff.findMany({
      where: { isDemo: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true, designation: true, salaryType: true, dailyWage: true, monthlySalary: true },
    }),
    db.attendance.findMany({
      where: { date: range },
      orderBy: { date: "asc" },
      select: { staffId: true, date: true, status: true, wageForDay: true, checkInTime: true, checkOutTime: true, markedByName: true },
    }),
    db.advance.findMany({ where: { givenAt: range }, orderBy: { givenAt: "asc" } }),
    db.fineRecord.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    db.rewardRecord.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
    db.job.findMany({
      where: { scheduledDate: range, deletedAt: null, isDemo: false },
      orderBy: { scheduledDate: "asc" },
      select: {
        id: true, jobNumber: true, customerName: true, area: true, service: true, scheduledDate: true, scheduledTime: true,
        status: true, jobValue: true, teamNumber: true, teamSnapshot: true,
        supervisor: { select: { name: true } },
        assignments: { select: { isLead: true, staff: { select: { name: true } } } },
      },
    }),
    db.teamIncentive.findMany({ where: { date: range }, orderBy: { date: "asc" } }),
  ]);

  const staffById = new Map(staff.map((s) => [s.id, s]));
  const sName = (id: string) => staffById.get(id)?.name ?? "(removed)";
  const sCode = (id: string) => staffById.get(id)?.employeeCode ?? "";
  const validSales = invoices.filter((i) => i.status !== "CANCELLED");
  const purchases = expenses.filter((e) => isPurchase(e.category));
  const salaryPaid = expenses.filter((e) => e.category === "SALARY");

  // ── Monthly business summary (1 row for a month export, 12 for a year) ──
  const months = period.month ? [period.month] : Array.from({ length: 12 }, (_, i) => i + 1);
  const salesBy = group(validSales, (i) => ym(i.createdAt));
  const revBy = group(revenueRows, (p) => ym(p.paidDate!));
  const expBy = group(expenses, (e) => ym(e.date));
  const businessRows = months.map((m) => {
    const k = `${period.year}-${String(m).padStart(2, "0")}`;
    const exp = expBy.get(k) ?? [];
    const sales = (salesBy.get(k) ?? []).reduce((s, i) => s + i.totalAmount, 0);
    const revenue = (revBy.get(k) ?? []).reduce((s, p) => s + p.paidAmount, 0);
    const totalExp = sum(exp);
    return {
      Month: k,
      "Total Sales (invoiced)": r2(sales),
      "Total Revenue (received)": r2(revenue),
      "Purchase entries": r2(sum(exp.filter((e) => isPurchase(e.category)))),
      "Salary paid": r2(sum(exp.filter((e) => e.category === "SALARY"))),
      "Other expenses": r2(sum(exp.filter((e) => !isPurchase(e.category) && e.category !== "SALARY"))),
      "Total Expenses": r2(totalExp),
      "Net / Balance (Revenue − Expenses)": r2(revenue - totalExp),
    };
  });
  if (businessRows.length > 1) {
    const keys = Object.keys(businessRows[0]).filter((k) => k !== "Month") as (keyof (typeof businessRows)[number])[];
    const total = Object.fromEntries(keys.map((k) => [k, r2(businessRows.reduce((s, r) => s + (r[k] as number), 0))]));
    businessRows.push({ Month: "TOTAL", ...total } as (typeof businessRows)[number]);
  }

  // ── Expenses by category ──
  const byCat = group(expenses, (e) => e.category);
  const categoryRows = [...byCat.entries()]
    .map(([c, rows]) => ({ Category: EXPENSE_CATEGORY_LABELS[c] ?? c, Purchase: isPurchase(c) ? "Y" : "", Entries: rows.length, Amount: r2(sum(rows)) }))
    .sort((a, b) => b.Amount - a.Amount);

  // ── Sales / Revenue / Purchase / Expenses detail ──
  const salesRows = invoices.map((i) => ({
    Date: d(i.createdAt),
    "Invoice No": i.invoiceNumber,
    "Job No": i.job?.jobNumber ?? "",
    Customer: i.customerName,
    Service: i.job ? SERVICE_LABELS[i.job.service] ?? i.job.service : "",
    "Sub Total": i.subTotal,
    Discount: i.discount,
    GST: i.gstAmount,
    Total: i.totalAmount,
    Status: i.status,
  }));
  const revenueSheet = revenueRows.map((p) => ({
    "Paid Date": d(p.paidDate),
    "Invoice No": p.invoiceNumber,
    "Job No": p.job?.jobNumber ?? "",
    Customer: p.clientName,
    Mode: p.mode ?? "",
    "Amount Received": p.paidAmount,
  }));
  const expRow = (e: (typeof expenses)[number]) => ({
    Date: d(e.date),
    Category: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
    Description: e.description,
    "Paid To": e.paidTo ?? "",
    Amount: e.amount,
    "Job No": e.job?.jobNumber ?? "",
    Staff: e.staff ? `${e.staff.name} (${e.staff.employeeCode})` : "",
  });

  // ── Attendance ──
  const attendanceRows = attendance.map((a) => ({
    Date: d(a.date),
    "Staff ID": sCode(a.staffId),
    Staff: sName(a.staffId),
    Status: a.status,
    "Check In": a.checkInTime ? a.checkInTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
    "Check Out": a.checkOutTime ? a.checkOutTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "",
    "Day Wage": a.wageForDay ?? "",
    "Marked By": a.markedByName ?? "",
  }));

  // ── Salary (per staff per month — same rule as the CRM payroll ledger) ──
  const key = (staffId: string, x: Date) => `${staffId}|${ym(x)}`;
  const attBy = group(attendance, (a) => key(a.staffId, a.date));
  const advBy = group(advances, (a) => key(a.staffId, a.givenAt));
  const fineBy = group(fines, (f) => key(f.staffId, f.date));
  const rewBy = group(rewards, (r) => key(r.staffId, r.date));
  const salaryRows: Record<string, unknown>[] = [];
  let salaryNetTotal = 0;
  for (const m of months) {
    const mk = `${period.year}-${String(m).padStart(2, "0")}`;
    for (const s of staff) {
      const k = `${s.id}|${mk}`;
      const att = attBy.get(k) ?? [];
      const adv = sum(advBy.get(k));
      const fin = sum(fineBy.get(k));
      const rew = sum(rewBy.get(k));
      if (att.length === 0 && !adv && !fin && !rew) continue; // no activity that month
      const { presentDays, payableDays, earned } = computeEarned(s, att);
      const net = earned + rew - adv - fin;
      salaryNetTotal += net;
      salaryRows.push({
        Month: mk,
        "Staff ID": s.employeeCode,
        Staff: s.name,
        Designation: s.designation,
        "Wage Type": s.salaryType === "DAILY" ? "Daily" : "Monthly",
        "Basic Rate": s.salaryType === "DAILY" ? s.dailyWage ?? 0 : s.monthlySalary ?? 0,
        "Present (incl. half)": presentDays,
        "Payable Days": payableDays,
        Earned: r2(earned),
        Rewards: r2(rew),
        Advances: r2(adv),
        "Debit/Fine": r2(fin),
        "Net Payable": r2(net),
      });
    }
  }

  const advanceRows = advances.map((a) => ({ Date: d(a.givenAt), "Staff ID": sCode(a.staffId), Staff: sName(a.staffId), Amount: a.amount, Reason: a.reason ?? "", "Given By": a.givenByName ?? "" }));
  const fineRows = fines.map((f) => ({ Date: d(f.date), "Staff ID": sCode(f.staffId), Staff: sName(f.staffId), Type: f.type, Amount: f.amount, Reason: f.notes ?? "", "Recorded By": f.recordedByName ?? "" }));
  const rewardRows = rewards.map((r) => ({ Date: d(r.date), "Staff ID": sCode(r.staffId), Staff: sName(r.staffId), Type: r.type, Amount: r.amount, Notes: r.notes ?? "", "Recorded By": r.recordedByName ?? "" }));

  // ── Jobs / Team + Team incentives ──
  const jobNo = new Map(jobs.map((j) => [j.id, j.jobNumber]));
  const missing = incentives.map((i) => i.jobId).filter((id) => !jobNo.has(id));
  if (missing.length) for (const j of await db.job.findMany({ where: { id: { in: missing } }, select: { id: true, jobNumber: true } })) jobNo.set(j.id, j.jobNumber);
  const incentiveByJob = new Map(incentives.map((i) => [i.jobId, i.amount]));
  const jobRows = jobs.map((j) => ({
    Date: d(j.scheduledDate),
    Time: j.scheduledTime,
    "Job No": j.jobNumber,
    Service: SERVICE_LABELS[j.service] ?? j.service,
    Area: j.area,
    Customer: j.customerName,
    Status: j.status,
    "Team No": j.teamNumber ?? "",
    Supervisor: j.supervisor?.name ?? "",
    "Team Members": teamNames(j.teamSnapshot, j.assignments),
    "Team Frozen At Completion": j.teamSnapshot ? "Y" : "N",
    "Team Incentive (team total)": incentiveByJob.get(j.id) ?? "",
    "Job Value": j.jobValue,
  }));
  const incentiveRows = incentives.map((i) => ({
    Date: d(i.date),
    "Job No": jobNo.get(i.jobId) ?? "",
    "Team Incentive (team total)": i.amount,
    Team: teamNames(i.teamSnapshot, []),
    "Recorded By": i.recordedByName ?? "",
  }));

  // ── Summary ──
  const totalSales = r2(validSales.reduce((s, i) => s + i.totalAmount, 0));
  const totalRevenue = r2(revenueRows.reduce((s, p) => s + p.paidAmount, 0));
  const totalExpenses = r2(sum(expenses));
  const summaryRows = [
    { Item: "Period", Value: label },
    { Item: "Generated", Value: new Date().toLocaleString("en-IN") },
    { Item: "Total Sales (invoices issued, excl. cancelled)", Value: totalSales },
    { Item: "Total Revenue (payments received — Profit dashboard rule)", Value: totalRevenue },
    { Item: "Purchase entries (material, chemicals, equipment)", Value: r2(sum(purchases)) },
    { Item: "Salary paid (Expenses → Salary)", Value: r2(sum(salaryPaid)) },
    { Item: "Total Expenses (all categories, incl. purchases & salary)", Value: totalExpenses },
    { Item: "Net / Balance (Revenue − Total Expenses)", Value: r2(totalRevenue - totalExpenses) },
    { Item: "Staff salary net payable (attendance ledger)", Value: r2(salaryNetTotal) },
    { Item: "Advances given (staff)", Value: r2(sum(advances)) },
    { Item: "Debit / fines (staff)", Value: r2(sum(fines)) },
    { Item: "Individual rewards (staff)", Value: r2(sum(rewards)) },
    { Item: "Team incentives (team totals)", Value: `${incentives.length} · ${r2(sum(incentives))}` },
    { Item: "Jobs scheduled (excl. cancelled)", Value: jobs.filter((j) => j.status !== "CANCELLED").length },
    { Item: "Jobs completed", Value: jobs.filter((j) => j.status === "COMPLETED").length },
    { Item: "Note", Value: "Purchase is shown separately but is already inside Total Expenses. Advances/fines/rewards are payroll adjustments, not company expenses." },
  ];

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) => {
    const empty = { Info: "No records in this period" };
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [empty]);
    ws["!cols"] = Object.keys(rows[0] ?? empty).map((c) => ({ wch: Math.min(Math.max(c.length + 2, 12), 40) }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("Summary", summaryRows);
  add("Business Summary", businessRows);
  add("Sales", salesRows);
  add("Revenue", revenueSheet);
  add("Purchase", purchases.map(expRow));
  add("Expenses", expenses.map(expRow));
  add("Expenses by Category", categoryRows);
  add("Attendance", attendanceRows);
  add("Salary", salaryRows);
  add("Salary Paid", salaryPaid.map(expRow));
  add("Advance", advanceRows);
  add("Debit-Fine", fineRows);
  add("Rewards", rewardRows);
  add("Team Incentives", incentiveRows);
  add("Jobs-Team", jobRows);
  wb.Props = { Title: `${COMPANY.name} — ${label}`, Company: COMPANY.name };

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const slug = period.month ? `${period.year}-${String(period.month).padStart(2, "0")}` : `${period.year}`;
  return { buffer, filename: `Sahara-Export-${slug}.xlsx` };
}
