import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { syncParties, varianceCheck, type SyncParty } from "@/server/mbb-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PARTIES = 100; // one chunk — keeps the VPS and the Cloudflare timeout safe

/** Super Admin only. POST { mode: "dry" | "apply" | "variance", batchId, parties: SyncParty[<=100] }. Dry mode writes nothing. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  let body: { mode?: string; batchId?: string; parties?: SyncParty[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parties = Array.isArray(body.parties) ? body.parties : [];
  if (parties.length > MAX_PARTIES) return NextResponse.json({ error: `At most ${MAX_PARTIES} parties per request` }, { status: 400 });
  const mode = body.mode === "apply" ? "apply" : body.mode === "variance" ? "variance" : "dry";
  const batchId = String(body.batchId ?? "mbbfull").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "mbbfull";
  if (mode === "variance") return NextResponse.json({ variance: await varianceCheck(parties) });
  const totals = await syncParties(parties, { dryRun: mode === "dry", batchId, actor: session.name });
  if (mode === "apply") {
    await db.auditLog.create({ data: { entityType: "MybillbookSync", entityId: batchId, action: "IMPORT", summary: `MyBillBook full-history sync chunk: ${totals.customersCreated} customers, ${totals.invoicesCreated} created / ${totals.invoicesUpdated} updated, ${totals.reviewItemsCreated} to review`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  }
  return NextResponse.json({ mode, totals });
}
