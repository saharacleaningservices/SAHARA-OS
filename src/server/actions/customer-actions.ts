"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { sendSMS } from "@/lib/sms";
import { sendWhatsAppMany } from "@/lib/whatsapp";
import { addTimelineEntry } from "@/server/timeline";

/**
 * Quick customer search for the Customer Actions top bar. Unrestricted
 * across the whole Lead/Job/Customer database by design — for every role
 * that has it. Francis (SUPERVISOR) is explicitly excluded: his 2026-09-21
 * final policy says he "must NOT have unrestricted access to the Customers
 * database," and the top bar itself already disappears for him (it's only
 * mounted when canAccess(role, "customers") is true, which his narrowed
 * nav no longer grants) — this direct-call block is defense in depth for
 * the same reason every other Server Action check in this codebase exists:
 * a UI gate alone doesn't stop a direct call.
 */
export async function searchCustomersQuick(q: string) {
  const session = await getSession();
  if (!session || session.role === "SUPERVISOR") return [];
  const term = q.trim();
  const digits = term.replace(/\D/g, "");

  const [leads, jobs, customers] = await Promise.all([
    db.lead.findMany({
      where: {
        deletedAt: null,
        OR: [
          term ? { name: { contains: term } } : {},
          digits ? { mobile: { contains: digits } } : {},
        ],
      },
      select: { name: true, mobile: true, id: true },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    db.job.findMany({
      where: {
        deletedAt: null,
        OR: [
          term ? { customerName: { contains: term } } : {},
          digits ? { customerMobile: { contains: digits } } : {},
        ],
      },
      select: { customerName: true, customerMobile: true },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    db.customer
      .findMany({
        where: { OR: [term ? { name: { contains: term } } : {}, digits ? { mobile: { contains: digits } } : {}] },
        select: { name: true, mobile: true },
        take: 15,
      })
      .catch(() => []),
  ]);

  const map = new Map<string, { name: string; mobile: string; leadId?: string }>();
  for (const l of leads) if (l.mobile && !map.has(l.mobile)) map.set(l.mobile, { name: l.name, mobile: l.mobile, leadId: l.id });
  for (const j of jobs) if (j.customerMobile && !map.has(j.customerMobile)) map.set(j.customerMobile, { name: j.customerName, mobile: j.customerMobile });
  for (const c of customers) if (c.mobile && !map.has(c.mobile)) map.set(c.mobile, { name: c.name, mobile: c.mobile });

  return [...map.values()].slice(0, 20);
}

/** Send an SMS to a customer + log it on their most recent lead. */
export async function sendCustomerSMS(mobile: string, name: string, body: string) {
  const session = await getSession();
  if (!session) return { error: "Not authorized" };
  const digits = mobile.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return { error: "Invalid mobile number" };
  const text = (body || "").trim().slice(0, 480) || `Hi ${name}, this is ${session.name} from Sahara Cleaning Services.`;

  await sendSMS({ kind: "OTHER", toNumber: digits, toName: name, body: text, relatedType: "Customer", relatedId: digits });

  const lead = await db.lead.findFirst({ where: { mobile: digits, deletedAt: null }, orderBy: { createdAt: "desc" } });
  if (lead) {
    await addTimelineEntry({ leadId: lead.id, type: "CALL", body: `SMS sent by ${session.name}: ${text}` }).catch(() => {});
  }
  return { success: true as const };
}

// ── Customer database — bulk WhatsApp campaign + master profile edit ──────
// (Master Prompt: "Customers: Full" access for Accounts — Excel import
// already existed via src/server/actions/import.ts; these two actions round
// out edit + bulk WhatsApp campaign for the /customers page.)

const MAX_CAMPAIGN_RECIPIENTS = 300; // matches flushWhatsAppQueue's per-run cap in src/lib/whatsapp.ts

function canManageCustomers(role: string | undefined): boolean {
  // Customers module (bulk WhatsApp campaign, customer-profile edit) is
  // full operational access for OPERATIONS too, per the owner's 2026-09-21
  // role policy — see SAHARA_OS_MASTER_REQUIREMENTS.md #2. SUPERVISOR
  // removed the same day by an explicit policy override: Francis must not
  // have unrestricted Customers database access. He can still send a
  // Booking Form/Review/Payment link and Call/WhatsApp a customer from a
  // Job/Lead's own detail page — that's a different, already-scoped code
  // path (createBookingLink in booking-links.ts) not gated by this check.
  return role === "ADMIN" || role === "ACCOUNTS" || role === "OPERATIONS";
}

/**
 * Sends one WhatsApp message to every selected customer (queued if the
 * Cloud API isn't configured yet — see sendWhatsApp in src/lib/whatsapp.ts,
 * nothing is ever silently dropped). "{name}" in the message is replaced
 * with each recipient's own name. Capped at MAX_CAMPAIGN_RECIPIENTS per
 * click so one click can't fire an unbounded number of API calls; select
 * fewer rows (or run it again) for a larger list.
 */
export async function bulkSendWhatsAppCampaign(
  recipients: { name: string; mobile: string }[],
  message: string,
): Promise<
  | { error: string }
  | { success: true; sent: number; queued: number; failed: number; total: number; skipped: number }
> {
  const session = await getSession();
  if (!session || !canManageCustomers(session.role)) return { error: "Not authorized" };
  const body = message.trim();
  if (!body) return { error: "Message is required" };
  if (recipients.length === 0) return { error: "No recipients selected" };

  const batch = recipients.slice(0, MAX_CAMPAIGN_RECIPIENTS);
  const results = await sendWhatsAppMany(
    batch.map((r) => ({
      kind: "REVIEW_CAMPAIGN",
      toNumber: r.mobile,
      toName: r.name || null,
      body: body.replace(/\{name\}/gi, r.name?.trim() || "there"),
      relatedType: "Customer",
      relatedId: r.mobile,
    })),
  );

  const sent = results.filter((r) => r.sent).length;
  const queued = results.filter((r) => r.queued).length;
  const failed = results.filter((r) => !r.sent && !r.queued).length;

  revalidatePath("/whatsapp-log");
  return {
    success: true as const,
    sent,
    queued,
    failed,
    total: batch.length,
    skipped: recipients.length - batch.length,
  };
}

/**
 * Create or update the Customer master row for one mobile number — the
 * "Edit" action on the customer detail page. Leads/Jobs history is never
 * touched; this only edits the additive master profile (name, area,
 * address, outstanding balance, source) that Excel import writes to.
 */
export async function upsertCustomerProfile(
  mobile: string,
  data: {
    name: string;
    alternateMobile?: string;
    address?: string;
    area?: string;
    outstandingBalance?: number;
    source?: string;
  },
): Promise<{ error: string } | { success: true }> {
  const session = await getSession();
  if (!session || !canManageCustomers(session.role)) return { error: "Not authorized" };

  const digits = mobile.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return { error: "Invalid mobile number" };
  const name = data.name.trim();
  if (!name) return { error: "Name is required" };

  const shared = {
    name,
    alternateMobile: data.alternateMobile?.trim() || null,
    address: data.address?.trim() || null,
    area: data.area?.trim() || null,
    outstandingBalance: Number.isFinite(data.outstandingBalance) ? (data.outstandingBalance as number) : 0,
    source: data.source?.trim() || null,
  };

  await db.customer.upsert({
    where: { mobile: digits },
    create: { mobile: digits, ...shared },
    update: shared,
  });

  revalidatePath(`/customers/${digits}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  return { success: true as const };
}


  /**
     * Repeat-customer lookup for the New Lead form — called when office staff
 * finish typing a mobile number so a returning customer's history (job
 * count, last service date, lifetime revenue) shows immediately, before
 * the enquiry is even saved. Returns null for a brand-new number.
 */
export async function getRepeatCustomerSummary(mobile: string) {
    const session = await getSession();
    if (!session) return null;
    const digits = mobile.replace(/\D/g, "").slice(-10);
    if (digits.length !== 10) return null;

  const { getCustomerHistory } = await import("@/server/customers");
    const { leads, jobs, payments, master } = await getCustomerHistory(digits);
    if (leads.length === 0 && jobs.length === 0 && payments.length === 0 && !master) return null;

  const totalRevenue = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + p.paidAmount, 0);
    const name = master?.name || leads[0]?.name || jobs[0]?.customerName || null;
    const lastServiceDate = jobs[0]?.scheduledDate ?? master?.lastServiceDate ?? null;

  return {
        name,
        jobCount: jobs.length,
        leadCount: leads.length,
        lastServiceDate,
        totalRevenue,
  };
}
