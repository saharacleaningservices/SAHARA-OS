import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { canSeeCustomerContact } from "@/lib/permissions";
import { getCustomerQuickHistory } from "@/server/customer-quick-history";

// Quick Search "Past History" popup data (owner 2026-10-25). Address + billing totals = money and contact data, so
// office roles only (ADMIN, ACCOUNTS) — the same rule as /api/customers/history for mobile look-ups.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!canSeeCustomerContact(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const data = await getCustomerQuickHistory(request.nextUrl.searchParams.get("mobile"));
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
