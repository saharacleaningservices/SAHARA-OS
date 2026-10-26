import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { PUBLIC_BOOKING_URL } from "@/lib/site-urls";
import { pdfResponse } from "@/server/document-pdf";
import { invoicePdfForToken, TOKEN_RE } from "@/server/public-documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** /booking/invoice/{token}/pdf — the customer's single-page A4 invoice (available once the job is completed). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token) || !rateLimit(`pdf:${clientIp(request.headers)}`, 40, 600).allowed) return new NextResponse("Not found", { status: 404 });
  const file = await invoicePdfForToken(token);
  if (!file) return NextResponse.redirect(new URL(`/booking/${token}`, PUBLIC_BOOKING_URL), 302);
  return pdfResponse(file, request.nextUrl.searchParams.get("download") === "1");
}
