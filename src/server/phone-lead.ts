import { db } from "@/lib/db";
import { generateLeadNumber } from "@/lib/id-generators";
import { cleanText, INQUIRY_SOURCES, isInquirySource, parseIndianMobile } from "@/lib/inquiry-input";
import { last10 } from "@/lib/phone";
import { addTimelineEntry } from "@/server/timeline";

/** The business lines a customer can ring / message. Logged on the lead so ad/GMB/website lines can be compared later. */
export const BUSINESS_LINES = {
  "7083347130": "7083347130 · GMB / Magarpatta line",
  "9175220270": "9175220270 · WhatsApp Cloud API line",
  "8956567130": "8956567130 · Primary line",
  OTHER: "Other number",
} as const;
export type BusinessLine = keyof typeof BUSINESS_LINES;
const SERVICES = ["HOME_DEEP_CLEANING", "COMMERCIAL_CLEANING", "HOUSEKEEPING", "PEST_CONTROL", "INTERIOR_PAINTING"] as const;
type Service = (typeof SERVICES)[number];

export type PhoneLeadInput = { mobile: string; name?: string; service?: string; line?: string; source?: string; note?: string };
export type PhoneLeadResult =
  | { ok: true; leadId: string; leadNumber: string; existing: boolean }
  | { ok: false; error: string };

/**
 * One-tap "log an incoming call / message" lead (Accounts + Admin). Dedupe uses the shared last10 normaliser: an open lead
 * (or one created in the last 24 h) for the same number only gets a timeline note — never a second lead.
 */
export async function createPhoneLead(user: { id: string; name: string }, input: PhoneLeadInput): Promise<PhoneLeadResult> {
  const p = parseIndianMobile(input.mobile);
  if (!p.ok) return { ok: false, error: p.error };
  const mobile = last10(p.mobile);
  const name = cleanText(input.name, 80);
  const note = cleanText(input.note, 400);
  const src = isInquirySource(input.source) ? INQUIRY_SOURCES[input.source] : INQUIRY_SOURCES.PHONE;
  const line = input.line && input.line in BUSINESS_LINES ? BUSINESS_LINES[input.line as BusinessLine] : null;
  const service: Service = (SERVICES as readonly string[]).includes(input.service ?? "") ? (input.service as Service) : "HOME_DEEP_CLEANING";
  const body = `${src.label} logged by ${user.name}${line ? ` on ${line}` : ""}${note ? ` — ${note}` : ""}`;

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const existing = await db.lead.findFirst({
    where: {
      deletedAt: null,
      OR: [{ mobile: { endsWith: mobile } }, { whatsapp: { endsWith: mobile } }],
      AND: [{ OR: [{ stage: { notIn: ["COMPLETED", "CANCELLED"] } }, { createdAt: { gte: dayAgo } }] }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, leadNumber: true },
  });
  if (existing) {
    await addTimelineEntry({ leadId: existing.id, type: src.lead === "WHATSAPP" ? "NOTE" : "CALL", body, authorId: user.id }).catch(() => {});
    return { ok: true, leadId: existing.id, leadNumber: existing.leadNumber, existing: true };
  }

  const customer = await db.customer.findUnique({ where: { mobile } }).catch(() => null);
  const leadNumber = await generateLeadNumber();
  const now = new Date();
  const lead = await db.lead.create({
    data: {
      leadNumber,
      name: name || customer?.name || `Caller ${mobile}`,
      mobile,
      whatsapp: mobile,
      area: customer?.area || "—",
      address: customer?.address || null,
      service: service as never,
      source: src.lead as never,
      acquisitionChannel: src.channel,
      firstTouchSource: src.channel,
      firstTouchAt: now,
      latestTouchSource: src.channel,
      latestTouchAt: now,
      // The person logging it is on the line right now — it is worked, not "uncontacted".
      stage: "INTERESTED",
      assignedToId: user.id,
      createdById: user.id,
      notes: [line ? `Line: ${line}` : "", note].filter(Boolean).join(" · ") || null,
    },
    select: { id: true, leadNumber: true },
  });
  await db.followUp.create({ data: { leadId: lead.id, dueDate: new Date(now.getTime() + 60 * 60 * 1000), type: "CALL", priority: "HIGH", notes: "Phone lead — qualify and send quote" } }).catch(() => {});
  await addTimelineEntry({ leadId: lead.id, type: "NOTE", body: `Lead created: ${body}`, authorId: user.id }).catch(() => {});
  return { ok: true, leadId: lead.id, leadNumber: lead.leadNumber, existing: false };
}
