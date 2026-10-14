import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { notify } from "@/server/notify";
import { sendWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email / Cognito Forms lead intake. A Google Apps Script on the contact@ mailbox posts one JSON
 * payload per new enquiry: { name, mobile, service, location, email, message, source }.
 *
 * Auth: Authorization: Bearer <EMAIL_LEAD_TOKEN> (falls back to CRON_TOKEN) — fails closed.
 * Alerts: in-app/push via notify() (Operations sees the masked version), plus a WhatsApp copy to the
 * Admin (notify) and to the Accounts user (Shoyab). Operations (Francis) gets NO WhatsApp lead alert.
 * WhatsApp sends go through sendWhatsApp(), so TEST MODE / opt-out rules still apply.
 */
function serviceFrom(text: string) {
  const t = text.toLowerCase();
  if (/pest|termite|cockroach|bed ?bug/.test(t)) return "PEST_CONTROL";
  if (/paint/.test(t)) return "INTERIOR_PAINTING";
  if (/housekeeping|manpower|facility/.test(t)) return "HOUSEKEEPING";
  if (/commercial|office|factory|warehouse|showroom|shop/.test(t)) return "COMMERCIAL_CLEANING";
  return "HOME_DEEP_CLEANING";
}

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const token = process.env.EMAIL_LEAD_TOKEN || process.env.CRON_TOKEN;
  const provided = req.headers.get("authorization") ?? "";
  if (!token || provided !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: Record<string, unknown> = {};
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mobile = str(raw.mobile ?? raw.phone, 40).replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) return NextResponse.json({ error: "No valid mobile number" }, { status: 400 });

  const name = str(raw.name, 120) || `Enquiry ${mobile}`;
  const serviceText = str(raw.service, 200);
  const message = str(raw.message, 1000);
  const location = str(raw.location, 200);
  const email = str(raw.email, 200);
  const sourceLabel = str(raw.source, 60) || "Email / Cognito Form";
  const service = serviceFrom(`${serviceText} ${message}`);

  // Reuse an open / very recent lead for the same number instead of creating a duplicate.
  const recent = await db.lead.findFirst({
    where: {
      mobile,
      deletedAt: null,
      OR: [{ stage: { notIn: ["COMPLETED"] } }, { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    await addTimelineEntry({ leadId: recent.id, type: "NOTE", body: `New enquiry via ${sourceLabel}: ${serviceText || "—"} ${message}`.trim() }).catch(() => {});
    // A repeat enquiry must not be silent: the team gets an in-app/push alert pointing at the existing lead.
    await notify({ kind: "NEW_INQUIRY", title: `🔁 Repeat enquiry — ${recent.name}`, body: `Repeat enquiry on ${recent.leadNumber} · ${serviceText || "new message"}`, href: `/leads/${recent.id}` }).catch(() => {});
    return NextResponse.json({ ok: true, matchedExisting: recent.leadNumber });
  }

  const existingCustomer = await db.customer.findUnique({ where: { mobile } }).catch(() => null);
  const leadNumber = await generateLeadNumber();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: existingCustomer?.name || name,
      mobile,
      whatsapp: mobile,
      area: location || existingCustomer?.area || "—",
      address: existingCustomer?.address || null,
      service: service as never,
      source: "WEBSITE" as never,
      acquisitionChannel: "Website Form",
      firstTouchSource: "Website Form",
      firstTouchAt: new Date(),
      latestTouchSource: "Website Form",
      latestTouchAt: new Date(),
      stage: "NEW",
      notes: [`Via ${sourceLabel}`, serviceText && `Service: ${serviceText}`, email && `Email: ${email}`, message && `Message: ${message}`]
        .filter(Boolean)
        .join("\n"),
    },
  });

  await db.followUp
    .create({ data: { leadId: lead.id, dueDate: new Date(Date.now() + 30 * 60 * 1000), type: "CALL", priority: "HIGH", notes: "New website/email enquiry — call to qualify" } })
    .catch(() => {});
  await addTimelineEntry({ leadId: lead.id, type: "NOTE", body: `Lead auto-created from ${sourceLabel}` }).catch(() => {});

  const title = `📩 New enquiry — ${lead.name}`;
  const body = `${leadNumber} · ${serviceText || service.replace(/_/g, " ").toLowerCase()}${location ? ` · ${location}` : ""}`;
  // In-app + push for Admin / Accounts / Operations (Operations sees masked numbers); WhatsApp copy to Admin.
  await notify({ kind: "NEW_INQUIRY", title, body, href: `/leads/${lead.id}`, whatsappToAdmin: true }).catch(() => {});

  // WhatsApp copy to the Accounts user (Shoyab). Never to Operations (Francis).
  const accounts = await db.user.findFirst({ where: { role: "ACCOUNTS", isActive: true }, orderBy: { createdAt: "asc" } }).catch(() => null);
  if (accounts?.phone) {
    await sendWhatsApp({
      kind: "OTHER",
      toNumber: accounts.phone,
      toName: accounts.name,
      body: `${title}\n${body}\n📞 ${mobile}${message ? `\n“${message.slice(0, 160)}”` : ""}`,
      relatedType: "Lead",
      relatedId: lead.id,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, created: leadNumber });
}
