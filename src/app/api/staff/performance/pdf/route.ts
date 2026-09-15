import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/session";
import { canViewSalary } from "@/lib/permissions";
import { getStaffPerformanceReport } from "@/server/staff-performance";
import { getCompanySettings } from "@/server/settings";
import { StaffPerformanceDocument } from "@/lib/pdf/staff-performance-document";
import { resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  // Pay/reward/fine figures — same gate as the individual payslip PDF.
  if (!canViewSalary(session.role)) return new NextResponse("Forbidden", { status: 403 });

  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year")) || now.getFullYear();
  const month = Number(request.nextUrl.searchParams.get("month")) || now.getMonth() + 1;

  const rows = await getStaffPerformanceReport(year, month);
  const settings = await getCompanySettings();
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const buffer = await renderToBuffer(StaffPerformanceDocument({ logoDataUrl, monthLabel, rows }));

  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="staff-performance-${year}-${String(month).padStart(2, "0")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
