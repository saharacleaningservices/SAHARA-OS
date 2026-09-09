import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { notify } from "@/server/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Missed-call → auto-lead. Point a telephony provider's missed-call webhook
 * (Exotel / Knowlarity / MyOperator / Servetel …) at this URL.
 *
 * Auth: Authorization: Bearer <MISSED_CALL_TOKEN> (falls back to CRON_TOKEN).
 * Accepts the caller number from common field names via GET query or JSON/form
 * POST: caller | from | CallFrom | mobile | number.
 */
function extractNumber(obj: Record<string, unknown>): string | null {
  for (const k of ["caller", "from", "CallFrom", "callfrom", "mobile", "number", "msisdn"]) {
    const v = obj[k];
    if (typeof v === "string" && v.replace(/\D/g, "").length >= 10) return v;
  }
  return null;
}

async function handle(req: NextRequest, raw: Record<string, unknown>) {
  const token = process.env.MISSED_CALL_TOKEN || process.env.CRON_TOKEN;
  const provided = req.headers.get("authorization") ?? "";
  const qToken = req.nextUrl.searchParams.get("token") ?? "";
  if (token && provided !== `Bearer ${token}` && qToken !== token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const number = extractNumber(raw);
  const mobile = (number ?? "").replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) return NextResponse.json({ error: "No valid caller number" }, { status: 400 });

  // Don't create a duplicate for a number we already have an open lead / a very
  // recent lead for.
  const recent = await db.lead.findFirst({
    where: {
      mobile,
      deletedAt: null,
      OR: [
        { stage: { notIn: ["COMPLETED"] } },
        { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    await addTimelineEntry({ leadId: recent.id, type: "CALL", body: "Missed call received (auto-detected)" }).catch(() => {});
    return NextResponse.json({ ok: true, matchedExisting: recent.leadNumber });
  }

  const existingCustomer = await db.customer.findUnique({ where: { mobile } }).catch(() => null);
  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: existingCustomer?.name || `Missed call ${mobile}`,
      mobile,
      whatsapp: mobile,
      area: existingCustomer?.area || "—",
      address: existingCustomer?.address || null,
      service: "HOME_DEEP_CLEANING" as never,
      source: "CALL" as never,
      stage: "NEW",
      notes: "Auto-created from a missed call — call back to qualify.",
    },
  });

  await db.followUp
    .create({
      data: { leadId: lead.id, dueDate: new Date(Date.now() + 15 * 60 * 1000), type: "CALL", priority: "HIGH", notes: "Missed call — call back" },
    })
    .catch(() => {});
  await addTimelineEntry({ leadId: lead.id, type: "CALL", body: "Missed call received — lead auto-created" }).catch(() => {});
  await notify({
    kind: "NEW_INQUIRY",
    title: `📞 Missed call — ${existingCustomer?.name || mobile}`,
    body: `Auto-lead ${leadNumber} · call back within 15 min`,
    href: `/leads/${lead.id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, created: leadNumber });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) body = await req.json();
    else {
      const fd = await req.formData();
      body = Object.fromEntries([...fd.entries()]);
    }
  } catch {
    body = {};
  }
  const merged = { ...Object.fromEntries(req.nextUrl.searchParams.entries()), ...body };
  return handle(req, merged);
}

export async function GET(req: NextRequest) {
  return handle(req, Object.fromEntries(req.nextUrl.searchParams.entries()));
}
