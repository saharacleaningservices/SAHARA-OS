import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { pdfResponse } from "@/server/document-pdf";
import { quotationPdfForToken, TOKEN_RE } from "@/server/public-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /booking/quotation/{token}/pdf — the customer's single-page A4 quotation. The booking token is the credential. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token) || !rateLimit(`pdf:${clientIp(request.headers)}`, 40, 600).allowed) return new NextResponse("Not found", { status: 404 });
  const file = await quotationPdfForToken(token);
  // No CRM quotation for this booking: show the web quotation instead of an error.
  if (!file) return NextResponse.redirect(new URL(`/booking/quotation/${token}`, PUBLIC_BOOKING_URL), 302);
  return pdfResponse(file, request.nextUrl.searchParams.get("download") === "1");
}
