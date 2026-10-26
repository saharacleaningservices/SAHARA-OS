import { NextRequest, NextResponse } from "next/server";
import { buildPublicCatalogue } from "@/server/public-catalogue";
import { apiError, apiJson, guardPublicApi } from "@/server/public-api";
import { isValidYmd } from "@/lib/public-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/public/v1/catalogue?serviceDate=YYYY-MM-DD — display-ready prices (see src/server/public-catalogue.ts). */
export async function GET(req: NextRequest) {
  const denied = guardPublicApi(req, "");
  if (denied) return denied;
  const serviceDate = req.nextUrl.searchParams.get("serviceDate") ?? undefined;
  if (serviceDate && !isValidYmd(serviceDate)) return apiError(400, "serviceDate must be a real date in YYYY-MM-DD format.", "VALIDATION");
  try {
    const catalogue = await buildPublicCatalogue(serviceDate);
    const etag = `"${catalogue.version}"`;
    const headers = { ETag: etag, "Cache-Control": "private, max-age=30" };
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
    return apiJson(catalogue, 200, headers);
  } catch (e) {
    console.error("[public-api] catalogue failed:", e);
    return apiError(503, "Temporarily unavailable.", "UNAVAILABLE");
  }
}
