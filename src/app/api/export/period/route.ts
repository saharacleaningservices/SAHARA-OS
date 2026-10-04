import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { canViewSalary } from "@/lib/permissions";
import { buildPeriodWorkbook } from "@/server/period-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export Center download — Admin + Accounts only (same gate as salary
 * figures). ?year=2026&month=10 for a month, ?year=2026&month=all for the
 * year. Built in memory and streamed back; nothing is written to disk.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewSalary(session.role)) return new NextResponse("Forbidden", { status: 403 });

  const sp = request.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const monthParam = sp.get("month");
  const month = monthParam === "all" ? null : Number(monthParam);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return new NextResponse("Invalid year", { status: 400 });
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) return new NextResponse("Invalid month", { status: 400 });

  const { buffer, filename } = await buildPeriodWorkbook({ year, month });

  await db.auditLog
    .create({
      data: {
        entityType: "Export",
        entityId: filename,
        action: "PERIOD_EXPORT",
        summary: `${session.name} downloaded ${filename}`,
        actorName: session.name,
        actorEmail: session.email,
      },
    })
    .catch(() => {});

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
