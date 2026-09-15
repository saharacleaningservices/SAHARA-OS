import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSession } from "@/lib/session";
import { canViewSalary } from "@/lib/permissions";
import { getStaffPerformanceReport } from "@/server/staff-performance";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewSalary(session.role)) return new NextResponse("Forbidden", { status: 403 });

  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year")) || now.getFullYear();
  const month = Number(request.nextUrl.searchParams.get("month")) || now.getMonth() + 1;

  const rows = await getStaffPerformanceReport(year, month);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const sheetData = rows.map((r) => ({
    "Employee Code": r.employeeCode,
    Name: r.name,
    Designation: r.designation,
    "Wage Type": r.wageType,
    "Jobs Completed": r.jobsCompleted,
    "Revenue Generated": r.revenueGenerated,
    "On-Time %": r.onTimePercent ?? "",
    "Present Days": r.presentDays,
    "Half Days": r.halfDays,
    "Absent Days": r.absentDays,
    "Off Days": r.offDays,
    Rewards: r.rewardTotal,
    Fines: r.fineTotal,
    "Earned Wage": r.earned,
    "Net Balance": r.netBalance,
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 20 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, monthLabel.slice(0, 31));

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="staff-performance-${year}-${String(month).padStart(2, "0")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
