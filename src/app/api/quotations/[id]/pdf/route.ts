import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { pdfResponse, renderQuotationPdf } from "@/server/document-pdf";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Quotations carry the customer mobile and amounts: Super Admin + Accounts only (owner rule 2026-10-08). The customer's own copy is
  // /booking/quotation/{token}/pdf, reached with the booking token.
  const { id } = await params;
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!["ADMIN", "ACCOUNTS"].includes(session.role)) return new NextResponse("Forbidden", { status: 403 });
  const file = await renderQuotationPdf(id);
  if (!file) return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  return pdfResponse(file);
}
