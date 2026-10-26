import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getSession } from "@/lib/session";
import { getCompanySettings } from "@/server/settings";
import { resolveBrandLogoDataUrl } from "@/lib/pdf/file-to-data-url";
import { DaySheetDocument } from "@/lib/pdf/day-sheet-document";
import { getDaySheet } from "@/server/day-sheet";
import { istDayKey } from "@/lib/ist-days";
import { jobDateWindowForRole } from "@/server/jobs";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-page-per-day job sheet for the dispatcher. Office roles only (Super Admin, Accounts, Operations, Field Coordinator); never Field Staff.
 * Francis (SUPERVISOR) gets today only, Operations yesterday–tomorrow (same windows as Team Dispatch). ?date=YYYY-MM-DD, default today.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"].includes(session.role)) return new NextResponse("Forbidden", { status: 403 });

  const param = request.nextUrl.searchParams.get("date");
  if (param && !/^\d{4}-\d{2}-\d{2}$/.test(param)) return new NextResponse("Invalid date", { status: 400 });
  const day = param ? new Date(`${param}T06:30:00Z`) : new Date();
  const dayKey = istDayKey(day);
  if (session.role === "SUPERVISOR" && dayKey !== istDayKey(new Date())) return new NextResponse("The day sheet is only available for today", { status: 403 });
  if (session.role === "OPERATIONS") {
    const w = jobDateWindowForRole(session.role);
    if (w && (day.getTime() < w.from.getTime() - 24 * 3600 * 1000 || day.getTime() > w.to.getTime() + 24 * 3600 * 1000)) return new NextResponse("Outside the allowed days", { status: 403 });
  }

  const [rows, settings] = await Promise.all([getDaySheet(day), getCompanySettings()]);
  const logoDataUrl = await resolveBrandLogoDataUrl(settings.logoUrl);
  const buffer = await renderToBuffer(
    DaySheetDocument({ dateLabel: formatDate(day), companyName: settings.name || "Sahara Cleaning Services", logoDataUrl, rows, generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) }),
  );
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="day-sheet-${dayKey}.pdf"`, "Cache-Control": "no-store" } });
}
