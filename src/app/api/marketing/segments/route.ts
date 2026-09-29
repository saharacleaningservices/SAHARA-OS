import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// Admin-only, READ-ONLY audience sizing for WhatsApp campaigns. Returns
// COUNTS only — never phone numbers. Contacts are de-duplicated by the last
// 10 digits of the mobile number; invalid/test numbers are excluded.
export const dynamic = "force-dynamic";

const COMMERCIAL = /office|shop|showroom|warehouse|factory|hospital|clinic|restaurant|society|complex|commercial/i;
const TEST = /\btest\b|demo|dummy|asdf|xxx/i;
const OPEN = ["NEW", "INTERESTED", "SITE_VISIT", "QUOTATION", "NEGOTIATION"];

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [leads, jobs] = await Promise.all([
    db.lead.findMany({
      where: { deletedAt: null },
      select: { mobile: true, whatsapp: true, name: true, isDemo: true, stage: true, serviceCategory: true, propertyType: true, createdAt: true, marketingConsent: true, quoteAmount: true, _count: { select: { quotations: true } } },
    }),
    db.job.findMany({ where: { deletedAt: null }, select: { customerMobile: true, customerName: true, status: true, completedAt: true, scheduledDate: true } }),
  ]);

  type C = { lead: boolean; job: boolean; completed: boolean; lastCompleted?: Date; quoted: boolean; open: boolean; lost: boolean; commercial: boolean; consent: string; lastEnquiry?: Date };
  const people = new Map<string, C>();
  let invalid = 0;
  let test = 0;
  const get = (m: string) => {
    if (!people.has(m)) people.set(m, { lead: false, job: false, completed: false, quoted: false, open: false, lost: false, commercial: false, consent: "UNKNOWN" });
    return people.get(m)!;
  };
  const norm = (raw?: string | null) => {
    const d = (raw ?? "").replace(/\D/g, "").slice(-10);
    return /^[6-9]\d{9}$/.test(d) ? d : null;
  };

  for (const l of leads) {
    if (l.isDemo || TEST.test(l.name ?? "")) { test++; continue; }
    const m = norm(l.mobile) ?? norm(l.whatsapp);
    if (!m) { invalid++; continue; }
    const c = get(m);
    c.lead = true;
    if (OPEN.includes(l.stage)) c.open = true;
    if (l.stage === "CANCELLED") c.lost = true;
    if (l.stage === "QUOTATION" || l.stage === "NEGOTIATION" || l._count.quotations > 0 || (l.quoteAmount ?? 0) > 0) c.quoted = true;
    if (l.serviceCategory === "COMMERCIAL_CLEANING" || COMMERCIAL.test(l.propertyType ?? "")) c.commercial = true;
    if (l.marketingConsent === "OPT_OUT" || (l.marketingConsent === "OPT_IN" && c.consent !== "OPT_OUT")) c.consent = l.marketingConsent;
    if (!c.lastEnquiry || l.createdAt > c.lastEnquiry) c.lastEnquiry = l.createdAt;
  }
  for (const j of jobs) {
    if (TEST.test(j.customerName ?? "")) continue;
    const m = norm(j.customerMobile);
    if (!m) continue;
    const c = get(m);
    if (j.status !== "CANCELLED") c.job = true;
    if (j.status === "COMPLETED") {
      c.completed = true;
      const d = j.completedAt ?? j.scheduledDate;
      if (!c.lastCompleted || d > c.lastCompleted) c.lastCompleted = d;
    }
  }

  const all = [...people.values()];
  const count = (f: (c: C) => boolean) => all.filter(f).length;
  const dueBefore = new Date(Date.now() - 90 * 86400000);
  const oldBefore = new Date(Date.now() - 14 * 86400000);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    rawRecords: { leads: leads.length, jobs: jobs.length, excludedInvalidNumbers: invalid, excludedTestOrDemo: test },
    uniqueContacts: all.length,
    segments: {
      existingCustomers_anyBooking: count((c) => c.job),
      completedCustomers: count((c) => c.completed),
      repeatCleaningDue_completedOver90DaysAgo: count((c) => c.completed && !!c.lastCompleted && c.lastCompleted < dueBefore),
      quotationButNoBooking: count((c) => c.quoted && !c.job),
      oldEnquiries_noQuoteNoBooking_over14Days: count((c) => c.lead && !c.quoted && !c.job && !c.lost && !!c.lastEnquiry && c.lastEnquiry < oldBefore),
      openEnquiries: count((c) => c.open && !c.job),
      lostLeads: count((c) => c.lost && !c.job),
      commercialOrSociety: count((c) => c.commercial),
      residential: count((c) => !c.commercial),
    },
    whatsappMarketingEligibility: {
      optIn: count((c) => c.consent === "OPT_IN"),
      optOut: count((c) => c.consent === "OPT_OUT"),
      unknown: count((c) => c.consent === "UNKNOWN"),
      note: "Consent has never been recorded in the CRM, so UNKNOWN is expected. Customers who booked a job have an existing business relationship; others need care under WhatsApp policy.",
    },
  });
}
