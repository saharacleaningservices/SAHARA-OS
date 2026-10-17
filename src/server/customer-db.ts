import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { generateCustomerNumber } from "@/lib/id-generators";

// One customer database for every intake (public booking, New Lead, manual
// CRM): a contact per normalized mobile number (Customer.mobile is unique) and
// any number of service sites under it. Everything here is additive — an
// existing contact is reused and only empty fields are filled in; nothing is
// ever deleted, merged or overwritten.

import { CONTACT_TYPES, CONTACT_TYPE_LABEL, isContactType, type ContactType } from "@/lib/contact-category";
export { CONTACT_TYPES, CONTACT_TYPE_LABEL, isContactType, type ContactType };

/** Last 10 digits — the duplicate key used everywhere for a mobile number. */
export function normalizeMobile(mobile: string | null | undefined): string | null {
  const d = (mobile ?? "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? d : null;
}

/** A short area name — not a fallback PIN code, dash or a whole address line. */
const cleanArea = (a: string | null | undefined) => {
  const v = (a ?? "").trim();
  if (!v || v === "—" || /^[\d\s-]+$/.test(v)) return null;
  if (v.includes(",") || v.length > 40) return null;
  return v;
};

/** Address comparison key: case, spacing and punctuation insensitive. */
export function addressKey(address: string | null | undefined): string {
  return (address ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Finds the contact for this mobile or creates it. An existing contact keeps
 * its data; only blank fields are filled. isRepeat can be switched on, never
 * off, here; contactType is applied only when it was chosen explicitly.
 */
export async function ensureCustomer(input: {
  mobile: string;
  name: string;
  alternateMobile?: string | null;
  email?: string | null;
  area?: string | null;
  address?: string | null;
  /** Client's registered / office address. When given it is the ONLY thing written to Customer.address
   *  (the work-site `address` then goes to a CustomerSite only); when absent the older behaviour applies. */
  officeAddress?: string | null;
  contactType?: string | null;
  isRepeat?: boolean | null;
  source?: string | null;
}) {
  const mobile = normalizeMobile(input.mobile);
  const office = input.officeAddress?.trim() || "";
  if (!mobile) return null;
  const existing = await db.customer.findUnique({ where: { mobile } });
  if (!existing) {
    return createWithCustomerNumber((customerNumber) => ({
        customerNumber,
        mobile,
        name: input.name.trim() || "Customer",
        alternateMobile: input.alternateMobile?.trim() || null,
        email: input.email?.trim() || null,
        area: cleanArea(input.area),
        address: office || input.address?.trim() || null,
        source: input.source ?? null,
        contactType: isContactType(input.contactType) ? input.contactType : "CUSTOMER",
        isRepeat: !!input.isRepeat,
    }));
  }
  const patch: Record<string, unknown> = {};
  if (!existing.customerNumber) patch.customerNumber = await generateCustomerNumber();
  if (!existing.alternateMobile && input.alternateMobile?.trim()) patch.alternateMobile = input.alternateMobile.trim();
  if (!existing.email && input.email?.trim()) patch.email = input.email.trim();
  if (!existing.area && cleanArea(input.area)) patch.area = cleanArea(input.area);
  if (office) {
    // Staff typed a registered address on purpose: it replaces the stored one when different.
    if (office !== (existing.address ?? "")) patch.address = office;
  } else if (!existing.address && input.address?.trim()) patch.address = input.address.trim();
  if (input.isRepeat && !existing.isRepeat) patch.isRepeat = true;
  if (isContactType(input.contactType) && input.contactType !== existing.contactType && input.contactType !== "CUSTOMER") patch.contactType = input.contactType;
  return Object.keys(patch).length ? db.customer.update({ where: { id: existing.id }, data: patch }) : existing;
}

/** Customer IDs for a set of mobiles (any spelling) — one query, for lists and PDFs. */
export async function customerNumbersByMobile(mobiles: (string | null | undefined)[]): Promise<Map<string, string>> {
  const keys = [...new Set(mobiles.map((m) => normalizeMobile(m)).filter((k): k is string => !!k))];
  if (!keys.length) return new Map();
  const rows = await db.customer.findMany({ where: { mobile: { in: keys }, customerNumber: { not: null } }, select: { mobile: true, customerNumber: true } });
  return new Map(rows.map((r) => [r.mobile, r.customerNumber as string]));
}

/** Customer ID for one mobile number, or null. */
export async function customerNumberFor(mobile: string | null | undefined): Promise<string | null> {
  return (await customerNumbersByMobile([mobile])).get(normalizeMobile(mobile) ?? "") ?? null;
}

/**
 * Creates a Customer with the next CUST-#### number. Two bookings at the same moment could pick the same
 * number; the unique index rejects the second, which then retries with a fresh number.
 */
export async function createWithCustomerNumber(data: (customerNumber: string) => Prisma.CustomerCreateInput) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.customer.create({ data: data(await generateCustomerNumber()) });
    } catch (e) {
      const dup = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target ?? "").includes("customerNumber");
      if (!dup || attempt >= 4) throw e;
    }
  }
}

/** Reuses the contact's site with the same address, or adds a new one. */
export async function ensureSite(
  customerId: string,
  site: { address?: string | null; pinCode?: string | null; area?: string | null; mapLink?: string | null; label?: string | null },
) {
  const address = site.address?.trim();
  if (!address) return null;
  const key = addressKey(address);
  const sites = await db.customerSite.findMany({ where: { customerId } });
  const match = sites.find((s) => addressKey(s.address) === key);
  if (match) {
    // Fill blanks only (e.g. a Maps pin added on a later booking).
    const patch: Record<string, unknown> = {};
    if (!match.pinCode && site.pinCode?.trim()) patch.pinCode = site.pinCode.trim();
    if (!match.area && cleanArea(site.area)) patch.area = cleanArea(site.area);
    if (!match.mapLink && site.mapLink?.trim()) patch.mapLink = site.mapLink.trim();
    return Object.keys(patch).length ? db.customerSite.update({ where: { id: match.id }, data: patch }) : match;
  }
  return db.customerSite.create({
    data: {
      customerId,
      label: site.label?.trim() || `Site ${sites.length + 1}`,
      address,
      pinCode: site.pinCode?.trim() || null,
      area: cleanArea(site.area),
      mapLink: site.mapLink?.trim() || null,
    },
  });
}

/**
 * Links an enquiry to the customer database: contact by mobile, then the
 * chosen site (if it belongs to that contact) or a matched/new site from the
 * address. Never throws — booking and lead creation must not fail because of it.
 */
export async function linkCustomerAndSite(input: {
  mobile: string;
  name: string;
  alternateMobile?: string | null;
  email?: string | null;
  address?: string | null;
  officeAddress?: string | null;
  pinCode?: string | null;
  area?: string | null;
  mapLink?: string | null;
  contactType?: string | null;
  isRepeat?: boolean | null;
  siteId?: string | null;
  source?: string | null;
}): Promise<{ customerId: string; siteId: string | null } | null> {
  try {
    const customer = await ensureCustomer(input);
    if (!customer) return null;
    if (input.siteId) {
      const chosen = await db.customerSite.findFirst({ where: { id: input.siteId, customerId: customer.id } });
      if (chosen) return { customerId: customer.id, siteId: chosen.id };
    }
    const site = await ensureSite(customer.id, input);
    return { customerId: customer.id, siteId: site?.id ?? null };
  } catch (e) {
    console.error("[customer-db] link failed:", e);
    return null;
  }
}
