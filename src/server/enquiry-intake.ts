import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { addTimelineEntry } from "@/server/timeline";
import { notify } from "@/server/notify";
import { sendWhatsApp } from "@/lib/whatsapp";

// Shared enquiry intake (moved out of /api/webhook/email-lead on 2026-10-22 so the direct Cognito Forms webhook uses the
// SAME rules): one open / very recent lead per mobile or e-mail is reused (timeline note + "Repeat enquiry" alert) instead
// of a duplicate; a new lead gets a HIGH call-back follow-up, an in-app/push alert (Operations sees the masked version), a
// WhatsApp copy to the Admin (via notify) and to the Accounts user. Nothing is sent to the customer. WhatsApp sends go
// through sendWhatsApp(), so TEST MODE / opt-out rules still apply.
//
// intakeKey (optional) makes a delivery idempotent: the same key never creates a second lead or a second repeat note
// (Lead.intakeKey is unique; a repeat note carries the key as a marker).

export function serviceFrom(text: string) {
  const t = text.toLowerCase();
  if (/pest|termite|cockroach|bed ?bug/.test(t)) return "PEST_CONTROL";
  if (/paint/.test(t)) return "INTERIOR_PAINTING";
  if (/housekeeping|manpower|facility/.test(t)) return "HOUSEKEEPING";
  if (/commercial|office|factory|warehouse|showroom|shop/.test(t)) return "COMMERCIAL_CLEANING";
  return "HOME_DEEP_CLEANING";
}

const str = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type EnquiryResult =
  | { ok: true; created: string }
  | { ok: true; matchedExisting: string }
  | { ok: true; duplicate: string }
  | { error: string; status: 400 };

const marker = (key: string) => `[intake:${key}]`;

export async function ingestEnquiry(raw: Record<string, unknown>, opts: { intakeKey?: string; defaultSource?: string } = {}): Promise<EnquiryResult> {
  const mobile = str(raw.mobile ?? raw.phone, 40).replace(/\D/g, "").slice(-10);
  if (mobile.length !== 10) return { error: "No valid mobile number", status: 400 };

  const intakeKey = opts.intakeKey ? opts.intakeKey.slice(0, 120) : undefined;
  if (intakeKey) {
    const done = await db.lead.findUnique({ where: { intakeKey }, select: { leadNumber: true } }).catch(() => null);
    if (done) return { ok: true, duplicate: done.leadNumber };
    const noted = await db.timelineEntry.findFirst({ where: { body: { contains: marker(intakeKey) } }, select: { lead: { select: { leadNumber: true } } } }).catch(() => null);
    if (noted?.lead) return { ok: true, duplicate: noted.lead.leadNumber };
  }

  const name = str(raw.name, 120) || `Enquiry ${mobile}`;
  const serviceText = str(raw.service, 200);
  const message = str(raw.message, 1000);
  const location = str(raw.location, 200);
  const emailRaw = str(raw.email, 200).toLowerCase();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : "";
  const sourceLabel = str(raw.source, 60) || opts.defaultSource || "Email / Cognito Form";
  const service = serviceFrom(`${serviceText} ${message}`);

  // Reuse an open / very recent lead for the same number — or the same e-mail (a customer who types a
  // different number) — instead of creating a duplicate. E-mails are stored lower-cased (see create below).
  const recent = await db.lead.findFirst({
    where: {
      AND: [
        { OR: [{ mobile }, ...(email ? [{ email }] : [])] },
        { deletedAt: null },
        { OR: [{ stage: { notIn: ["COMPLETED"] } }, { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const note = `New enquiry via ${sourceLabel}: ${serviceText || "—"} ${message}`.trim();
    await addTimelineEntry({ leadId: recent.id, type: "NOTE", body: intakeKey ? `${note} ${marker(intakeKey)}` : note }).catch(() => {});
    // A repeat enquiry must not be silent: the team gets an in-app/push alert pointing at the existing lead.
    await notify({ kind: "NEW_INQUIRY", title: `🔁 Repeat enquiry — ${recent.name}`, body: `Repeat enquiry on ${recent.leadNumber} · ${serviceText || "new message"}`, href: `/leads/${recent.id}` }).catch(() => {});
    return { ok: true, matchedExisting: recent.leadNumber };
  }

  const existingCustomer = await db.customer.findUnique({ where: { mobile } }).catch(() => null);
  const leadNumber = await generateLeadNumber();
  let lead;
  try {
    lead = await db.lead.create({
      data: {
        leadNumber,
        ...(intakeKey ? { intakeKey } : {}),
        name: existingCustomer?.name || name,
        mobile,
        whatsapp: mobile,
        email: email || existingCustomer?.email || null,
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
  } catch (e) {
    // Two deliveries of the same entry racing each other: the unique intakeKey lets only one through.
    if (intakeKey && (e as { code?: string }).code === "P2002") {
      const done = await db.lead.findUnique({ where: { intakeKey }, select: { leadNumber: true } });
      if (done) return { ok: true, duplicate: done.leadNumber };
    }
    throw e;
  }

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

  return { ok: true, created: leadNumber };
}
