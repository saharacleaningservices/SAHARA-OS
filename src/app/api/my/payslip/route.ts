import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/session";
import { getStaffLedger } from "@/server/attendance";
import { getMyStaff } from "@/server/staff-portal";
import { getCompanySettings } from "@/server/settings";
import { PayslipDocument } from "@/lib/pdf/payslip-document";
import { resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { formatINR } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Staff App — the signed-in staff member's OWN salary slip. The staff id is
 * resolved from the session only (never a URL parameter), so one staff
 * member can never open another's slip. Same PDF and same ledger rule as the
 * office payslip (/api/staff/[id]/payslip/pdf).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "STAFF") return new NextResponse("Forbidden", { status: 403 });
  const me = await getMyStaff(session);
  if (!me) return new NextResponse("No staff profile linked", { status: 404 });

  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year")) || now.getFullYear();
  const month = Number(request.nextUrl.searchParams.get("month")) || now.getMonth() + 1;
  if (year < 2020 || year > 2100 || month < 1 || month > 12) return new NextResponse("Invalid month", { status: 400 });

  const ledger = await getStaffLedger(me.id, year, month);
  if (!ledger.staff) return new NextResponse("Not found", { status: 404 });
  const s = ledger.staff;

  const settings = await getCompanySettings();
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month, 0).getDate();
  const absentDays = ledger.attendance.filter((a) => a.status === "ABSENT").length;
  const offDays = ledger.attendance.filter((a) => a.status === "LEAVE").length;

  const buffer = await renderToBuffer(
    PayslipDocument({
      logoDataUrl,
      monthLabel,
      employeeCode: s.employeeCode,
      name: s.name,
      designation: s.designation,
      mobile: s.mobile,
      wageType: s.salaryType === "DAILY" ? "Daily Wage" : "Monthly Salary",
      baseRate: s.salaryType === "DAILY" ? `${formatINR(s.dailyWage ?? 0)} / day` : `${formatINR(s.monthlySalary ?? 0)} / month`,
      bankAccount: s.bankAccount ?? null,
      bankIfsc: s.bankIfsc ?? null,
      gpayNumber: s.gpayNumber ?? null,
      presentDays: ledger.presentDays,
      absentDays,
      offDays: offDays + Math.max(daysInMonth - ledger.attendance.length, 0),
      earned: ledger.earned,
      rewardTotal: ledger.rewardTotal,
      advanceTotal: ledger.advanceTotal,
      fineTotal: ledger.fineTotal,
      netBalance: ledger.netBalance,
    }),
  );

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="salary-slip-${s.employeeCode}-${year}-${String(month).padStart(2, "0")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
