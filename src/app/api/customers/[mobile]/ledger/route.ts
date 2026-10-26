import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getPartyLedger } from "@/server/party-ledger";
import { ledgerWorkbook } from "@/server/party-ledger-export";
import { ledgerPdf } from "@/server/party-ledger-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ledger Statement download for one party: ?format=pdf | xlsx. Money + customer data: Super Admin and Accounts only (like the invoice PDFs). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ mobile: string }> }) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "ACCOUNTS"].includes(session.role)) return new NextResponse("Forbidden", { status: 403 });
  const format = request.nextUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "xlsx") return new NextResponse("Invalid format", { status: 400 });
  const { mobile } = await params;
  if (mobile.replace(/\D/g, "").length < 10) return new NextResponse("Invalid mobile", { status: 400 });

  const ledger = await getPartyLedger(mobile);
  const file = format === "pdf" ? await ledgerPdf(ledger) : ledgerWorkbook(ledger);
  await db.auditLog.create({ data: { entityType: "Customer", entityId: ledger.mobile, action: "LEDGER_EXPORT", summary: `${session.name} downloaded the ${format.toUpperCase()} ledger statement of ${ledger.name}`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
