import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { canViewSalary } from "@/lib/permissions";
import { isFy } from "@/lib/fy";
import { buildGstr1Workbook } from "@/server/gstr1-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Multi-year GSTR-1 working file (.xlsx) — Super Admin + Accounts (same gate as the FY exports). ?from=2021-22&to=2026-27 (max 10 years). */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewSalary(session.role)) return new NextResponse("Forbidden", { status: 403 });
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to") ?? from;
  if (!isFy(from) || !isFy(to)) return new NextResponse("Invalid financial year", { status: 400 });
  const years = Number(to.slice(0, 4)) - Number(from.slice(0, 4)) + 1;
  if (years < 1 || years > 10) return new NextResponse("Choose 1 to 10 financial years", { status: 400 });

  const { buffer, filename, rows } = await buildGstr1Workbook(from, to);
  await db.auditLog.create({ data: { entityType: "Export", entityId: filename, action: "GSTR1_EXPORT", summary: `${session.name} downloaded ${filename} (${rows} invoice lines)`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
