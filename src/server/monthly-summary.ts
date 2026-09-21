import { db } from "@/lib/db";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { COMPANY } from "@/lib/constants";
import { sendWhatsApp } from "@/lib/whatsapp";
import { monthlyBusinessSummaryMessage } from "@/lib/whatsapp-templates";

/**
 * Requirement: Shoaib's monthly management report — Total Sales, Total
 * Expenses (Employee Salaries, Vendor Payments, Misc/Other), and the
 * Sales-vs-Expenses difference. Defaults to last month, matching the
 * once-a-month send on the 1st.
 *
 * Employee Salaries is the accrued payroll cost for the month — the same
 * present-days/wage formula the Staff payroll ledger already uses
 * (src/server/attendance.ts getStaffLedger) — not the STAFF_ADVANCE expense
 * category, which is cash already advanced against that pay and is counted
 * separately inside "Other Expenses" below.
 */
export async function getMonthlyBusinessReport(forDate: Date = subMonths(new Date(), 1)) {
  const start = startOfMonth(forDate);
  const end = endOfMonth(forDate);
  const monthLabel = format(start, "MMMM yyyy");

  const [salesAgg, vendorAgg, otherExpensesAgg, staffWithAttendance] = await Promise.all([
    db.payment.aggregate({
      where: { deletedAt: null, status: "PAID", paidDate: { gte: start, lte: end } },
      _sum: { paidAmount: true },
    }),
    db.expense.aggregate({
      where: { deletedAt: null, category: "VENDOR_PAYMENT", date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { deletedAt: null, category: { not: "VENDOR_PAYMENT" }, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    db.staff.findMany({
      where: { deletedAt: null },
      select: {
        salaryType: true,
        monthlySalary: true,
        attendance: {
          where: { date: { gte: start, lte: end } },
          select: { status: true, wageForDay: true },
        },
      },
    }),
  ]);

  let employeeSalaries = 0;
  for (const staff of staffWithAttendance) {
    if (staff.salaryType === "DAILY") {
      employeeSalaries += staff.attendance.reduce((sum, a) => sum + (a.wageForDay ?? 0), 0);
    } else if (staff.monthlySalary) {
      const presentDays = staff.attendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
      employeeSalaries += (staff.monthlySalary / 30) * presentDays;
    }
  }

  const totalSales = salesAgg._sum.paidAmount ?? 0;
  const vendorPayments = vendorAgg._sum.amount ?? 0;
  const otherExpenses = otherExpensesAgg._sum.amount ?? 0;
  const totalExpenses = employeeSalaries + vendorPayments + otherExpenses;

  return {
    monthLabel,
    totalSales,
    employeeSalaries,
    vendorPayments,
    otherExpenses,
    totalExpenses,
    difference: totalSales - totalExpenses,
  };
}

export async function sendMonthlyBusinessSummary(forDate?: Date) {
  const report = await getMonthlyBusinessReport(forDate);
  const adminNumbers = (process.env.ADMIN_WHATSAPP_NUMBERS || COMPANY.phones[0])
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const body = monthlyBusinessSummaryMessage(report);
  let sent = 0;
  for (const number of adminNumbers) {
    const res = await sendWhatsApp({ kind: "MONTHLY_SUMMARY", toNumber: number, body });
    if (res.sent || res.queued) sent += 1;
  }
  return { sent, report };
}
