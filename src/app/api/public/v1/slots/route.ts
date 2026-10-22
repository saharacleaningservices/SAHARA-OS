import { NextRequest } from "next/server";
import { publicSlots } from "@/server/public-slots";
import { apiError, apiJson, guardPublicApi } from "@/server/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/public/v1/slots?date=YYYY-MM-DD  or  ?days=21 — customer-visible slot availability. */
export async function GET(req: NextRequest) {
  const denied = guardPublicApi(req, "");
  if (denied) return denied;
  try {
    const r = await publicSlots({ date: req.nextUrl.searchParams.get("date"), days: req.nextUrl.searchParams.get("days") });
    if (!r.ok) return apiError(400, "date must be a real date in YYYY-MM-DD format.", "VALIDATION");
    return apiJson(r.body);
  } catch (e) {
    console.error("[public-api] slots failed:", e);
    return apiError(503, "Temporarily unavailable.", "UNAVAILABLE");
  }
}
