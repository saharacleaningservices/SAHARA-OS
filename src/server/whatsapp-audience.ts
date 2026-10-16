import { db } from "@/lib/db";

// WhatsApp marketing audience. The ONLY people a promotional message may go
// to: a valid Indian mobile with an explicit, recorded WhatsApp marketing
// opt-in (booking-form checkbox, or staff recording the customer's consent)
// who has not opted out anywhere (lead record or a STOP reply). Contacts are
// de-duplicated by the last 10 digits. Never assumes consent.

const TEST = /\btest\b|demo|dummy|asdf|xxx/i;

export const last10 = (raw?: string | null) => {
  const d = (raw ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
};

const consentOf = (v?: string | null) => (/OUT/.test(v ?? "") ? "OPT_OUT" : /IN$/.test(v ?? "") ? "OPT_IN" : "UNKNOWN");

export type AudienceMember = { mobile: string; name: string };

export async function getWhatsAppMarketingAudience() {
  const [leads, jobs, customers, stops] = await Promise.all([
    db.lead.findMany({
      where: { deletedAt: null, isDemo: false },
      select: { mobile: true, whatsapp: true, name: true, marketingConsent: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.job.findMany({ where: { deletedAt: null }, select: { customerMobile: true } }),
    db.customer.findMany({ select: { mobile: true } }),
    db.whatsAppConsent.findMany({ where: { optedOut: true }, select: { phoneNumber: true } }),
  ]);

  const people = new Map<string, { name: string; consent: string }>();
  for (const l of leads) {
    if (TEST.test(l.name ?? "")) continue;
    const m = last10(l.whatsapp) ?? last10(l.mobile);
    if (!m) continue;
    const prev = people.get(m);
    const c = consentOf(l.marketingConsent);
    // An opt-out anywhere wins; otherwise the latest explicit choice counts.
    const consent = prev?.consent === "OPT_OUT" || c === "OPT_OUT" ? "OPT_OUT" : c === "OPT_IN" ? "OPT_IN" : prev?.consent ?? "UNKNOWN";
    people.set(m, { name: l.name || prev?.name || "", consent });
  }
  // Customers who booked or were imported but never gave consent are counted as UNKNOWN.
  for (const raw of [...jobs.map((j) => j.customerMobile), ...customers.map((c) => c.mobile)]) {
    const m = last10(raw);
    if (m && !people.has(m)) people.set(m, { name: "", consent: "UNKNOWN" });
  }
  for (const s of stops) {
    const m = last10(s.phoneNumber);
    if (m) people.set(m, { name: people.get(m)?.name ?? "", consent: "OPT_OUT" });
  }

  const all = [...people.entries()];
  const eligible: AudienceMember[] = all.filter(([, p]) => p.consent === "OPT_IN").map(([mobile, p]) => ({ mobile, name: p.name }));
  return {
    totalContacts: all.length,
    optIn: eligible.length,
    optOut: all.filter(([, p]) => p.consent === "OPT_OUT").length,
    unknown: all.filter(([, p]) => p.consent === "UNKNOWN").length,
    eligible,
  };
}

/** The subset of the given numbers that may receive promotional WhatsApp messages. */
export async function filterToMarketingOptIn<T extends { mobile: string }>(recipients: T[]) {
  const { eligible } = await getWhatsAppMarketingAudience();
  const ok = new Set(eligible.map((e) => e.mobile));
  const allowed = recipients.filter((r) => {
    const m = last10(r.mobile);
    return m ? ok.has(m) : false;
  });
  return { allowed, skipped: recipients.length - allowed.length };
}

/** Controlled QA numbers approved by the owner for WhatsApp test sends. */
export const WHATSAPP_TEST_NUMBERS = ["9800817070"];
