"use server";

// Header "Package Calculator" → Save/Attach to Lead. Reuses updateLead, so the
// same pricing guard (only Super Admin / Accounts may change prices/discount),
// Francis's today/tomorrow lead scope and audit trail apply. No second price list.

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { fieldLeadWhere } from "@/server/leads";
import { updateLead } from "@/server/actions/leads";
import { addTimelineEntry } from "@/server/timeline";
import { canEditPackagePricing, packageTotals, parsePackage } from "@/lib/package-calc";

const OFFICE = ["ADMIN", "ACCOUNTS", "OPERATIONS", "SUPERVISOR"];

export async function getPackageCalculatorAccess() {
  const session = await getSession();
  if (!session || !OFFICE.includes(session.role)) return null;
  return { canEditPrice: canEditPackagePricing(session.role) };
}

/** Open enquiries (no booking yet) matching name / mobile / lead number — within the caller's lead scope. */
export async function searchLeadsForPackage(q: string) {
  const session = await getSession();
  if (!session || !OFFICE.includes(session.role)) return [];
  const term = q.trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const rows = await db.lead.findMany({
    where: {
      deletedAt: null,
      stage: { notIn: ["JOB_SCHEDULED", "COMPLETED", "CANCELLED"] },
      jobs: { none: { deletedAt: null } },
      // AND, not spread: the field-role scope has its own OR, which must not replace the search terms.
      AND: [{ OR: [{ name: { contains: term } }, { leadNumber: { contains: term.toUpperCase() } }, ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : [])] }, fieldLeadWhere(session)],
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, leadNumber: true, name: true, area: true, stage: true },
  });
  return rows;
}

/** Attach the calculator's package to an open enquiry (before Confirm Booking). */
export async function attachPackageToLead(leadId: string, serviceItems: string, discountAmount: number) {
  const session = await getSession();
  if (!session || !OFFICE.includes(session.role)) return { error: "Not authorized" };
  const lead = await db.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, leadNumber: true, jobs: { where: { deletedAt: null }, select: { jobNumber: true } } } });
  if (!lead) return { error: "Lead not found" };
  if (lead.jobs.length) return { error: `${lead.leadNumber} is already booked (job ${lead.jobs[0].jobNumber}) — change the job instead.` };
  if (!parsePackage(serviceItems).lines.length) return { error: "Add at least one service" };
  const res = await updateLead(leadId, { serviceCategory: "CUSTOMIZER_PACKAGE", service: "HOUSEKEEPING", serviceItems, discountAmount });
  if ("error" in res && res.error) return { error: res.error };
  const saved = await db.lead.findUnique({ where: { id: leadId }, select: { serviceItems: true, discountAmount: true } });
  const t = packageTotals(parsePackage(saved?.serviceItems, saved?.discountAmount));
  await addTimelineEntry({ leadId, type: "NOTE", body: `Package attached from Package Calculator — ${parsePackage(saved?.serviceItems).lines.length} service(s), final ₹${t.final.toLocaleString("en-IN")}`, authorId: session.sub }).catch(() => {});
  return { success: true as const, leadNumber: lead.leadNumber, final: t.final };
}

/**
 * Package Calculator customer search by name (or part of a mobile number).
 * Super Admin / Accounts search the customer database; Operations only the
 * enquiries already in his own lead scope. Returns name, mobile and area only.
 */
export async function searchCustomersForCalculator(q: string) {
  const session = await getSession();
  if (!session || !OFFICE.includes(session.role)) return [];
  const term = q.trim();
  if (term.length < 3) return [];
  const digits = term.replace(/\D/g, "");
  const byMobile = new Map<string, { name: string; mobile: string; area: string | null }>();
  const add = (name: string, mobile: string | null, area: string | null) => {
    const key = (mobile ?? "").replace(/\D/g, "").slice(-10);
    if (key.length === 10 && !byMobile.has(key)) byMobile.set(key, { name, mobile: key, area });
  };
  if (session.role === "ADMIN" || session.role === "ACCOUNTS") {
    const masters = await db.customer.findMany({
      where: { OR: [{ name: { contains: term } }, ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : [])] },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { name: true, mobile: true, area: true },
    });
    masters.forEach((c) => add(c.name, c.mobile, c.area));
  }
  if (byMobile.size < 8) {
    const leads = await db.lead.findMany({
      where: {
        deletedAt: null,
        AND: [{ OR: [{ name: { contains: term } }, ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : [])] }, fieldLeadWhere(session)],
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { name: true, mobile: true, area: true },
    });
    leads.forEach((l) => add(l.name, l.mobile, l.area));
  }
  return Array.from(byMobile.values()).slice(0, 8);
}
