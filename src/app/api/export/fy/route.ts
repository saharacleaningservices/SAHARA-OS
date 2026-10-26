import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { canViewSalary } from "@/lib/permissions";
import { isFy } from "@/lib/fy";
import { buildFyWorkbook, type FyReport } from "@/server/fy-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Financial-year Excel export — Super Admin + Accounts only (same gate as the Export Center). ?fy=2024-25&report=sales|gst|quotations */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewSalary(session.role)) return new NextResponse("Forbidden", { status: 403 });
  const fy = request.nextUrl.searchParams.get("fy");
  const report = request.nextUrl.searchParams.get("report");
  if (!isFy(fy)) return new NextResponse("Invalid financial year", { status: 400 });
  if (report !== "sales" && report !== "gst" && report !== "quotations") return new NextResponse("Invalid report", { status: 400 });

  const { buffer, filename } = await buildFyWorkbook(fy, report as FyReport);
  await db.auditLog.create({ data: { entityType: "Export", entityId: filename, action: "FY_EXPORT", summary: `${session.name} downloaded ${filename}`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
