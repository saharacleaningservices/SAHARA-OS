import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/session";
import { canViewSalary } from "@/lib/permissions";
import { getStaffLedger } from "@/server/attendance";
import { getCompanySettings } from "@/server/settings";
import { PayslipDocument } from "@/lib/pdf/payslip-document";
import { publicFileToDataUrl } from "@/lib/pdf/file-to-data-url";
import { formatINR } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  // Salary slips carry pay figures — Admin only (see canViewSalary).
  if (!canViewSalary(session.role)) return new NextResponse("Forbidden", { status: 403 });

  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year")) || now.getFullYear();
  const month = Number(request.nextUrl.searchParams.get("month")) || now.getMonth() + 1;

  const ledger = await getStaffLedger(id, year, month);
  if (!ledger.staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const settings = await getCompanySettings();
  const logoDataUrl = settings.logoUrl ? await publicFileToDataUrl(settings.logoUrl) : null;

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const daysInMonth = new Date(year, month, 0).getDate();
  const absentDays = ledger.attendance.filter((a) => a.status === "ABSENT").length;
  const offDays = ledger.attendance.filter((a) => a.status === "LEAVE").length;
  const s = ledger.staff;

  const buffer = await renderToBuffer(
    PayslipDocument({
      logoDataUrl,
      monthLabel,
      employeeCode: s.employeeCode,
      name: s.name,
      designation: s.designation,
      mobile: s.mobile,
      wageType: s.salaryType === "DAILY" ? "Daily Wage" : "Monthly Salary",
      baseRate:
        s.salaryType === "DAILY"
          ? `${formatINR(s.dailyWage ?? 0)} / day`
          : `${formatINR(s.monthlySalary ?? 0)} / month`,
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
      "Content-Disposition": `${disposition}; filename="payslip-${s.employeeCode}-${year}-${String(month).padStart(2, "0")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
