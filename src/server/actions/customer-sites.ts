"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ensureCustomer, isContactType, normalizeMobile } from "@/server/customer-db";
import { getCustomersPage, type CustomerFilters } from "@/server/customers";

// Customer database actions for the Customers module — Super Admin and
// Accounts, the same roles that can open /customers. Additive only: sites
// and contact details are created/edited, never deleted or merged.

async function requireCustomerEditor() {
  const s = await getSession();
  return s && (s.role === "ADMIN" || s.role === "ACCOUNTS") ? s : null;
}

const siteSchema = z.object({
  mobile: z.string(),
  name: z.string().max(120).optional(),
  siteId: z.string().max(40).optional().or(z.literal("")),
  label: z.string().trim().max(60).optional().or(z.literal("")),
  address: z.string().trim().min(5, "Enter the full site address").max(400),
  pinCode: z.string().trim().regex(/^(\d{6})?$/, "PIN code must be 6 digits").optional().or(z.literal("")),
  area: z.string().trim().max(80).optional().or(z.literal("")),
  mapLink: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Add a new service site under a contact, or edit one of its sites. */
export async function saveCustomerSite(values: unknown) {
  if (!(await requireCustomerEditor())) return { error: "Not authorized" };
  const parsed = siteSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid site" };
  const d = parsed.data;
  const mobile = normalizeMobile(d.mobile);
  if (!mobile) return { error: "Invalid mobile number" };
  const customer = await ensureCustomer({ mobile, name: d.name || "Customer" });
  if (!customer) return { error: "Invalid mobile number" };
  const data = {
    label: d.label || null,
    address: d.address,
    pinCode: d.pinCode || null,
    area: d.area || null,
    mapLink: d.mapLink || null,
    notes: d.notes || null,
  };
  if (d.siteId) {
    const site = await db.customerSite.findFirst({ where: { id: d.siteId, customerId: customer.id } });
    if (!site) return { error: "Site not found for this customer" };
    await db.customerSite.update({ where: { id: site.id }, data });
  } else {
    const count = await db.customerSite.count({ where: { customerId: customer.id } });
    await db.customerSite.create({ data: { ...data, customerId: customer.id, label: data.label || `Site ${count + 1}` } });
  }
  revalidatePath(`/customers/${mobile}`);
  revalidatePath("/customers");
  return { ok: true };
}

const metaSchema = z.object({
  mobile: z.string(),
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  contactType: z.string().refine(isContactType, "Choose a contact type"),
  isRepeat: z.boolean(),
});

/** Contact type, repeat flag, email (and name) for one contact. */
export async function updateContactMeta(values: unknown) {
  if (!(await requireCustomerEditor())) return { error: "Not authorized" };
  const parsed = metaSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;
  const mobile = normalizeMobile(d.mobile);
  if (!mobile) return { error: "Invalid mobile number" };
  const customer = await ensureCustomer({ mobile, name: d.name });
  if (!customer) return { error: "Invalid mobile number" };
  await db.customer.update({
    where: { id: customer.id },
    data: { name: d.name, email: d.email || null, contactType: d.contactType, isRepeat: d.isRepeat },
  });
  revalidatePath(`/customers/${mobile}`);
  revalidatePath("/customers");
  return { ok: true };
}

/** CSV rows for the current search/filter — fetched only when Export is clicked. */
export async function exportCustomerRows(filters: CustomerFilters) {
  if (!(await requireCustomerEditor())) return null;
  const { rows } = await getCustomersPage({ ...filters, page: 1, pageSize: 100_000 });
  return rows.map((c) => ({
    Name: c.name,
    Mobile: c.mobile,
    Type: c.contactType,
    Repeat: c.isRepeat ? "Yes" : "",
    Area: c.area ?? "",
    Sites: c.siteCount,
    Leads: c.leadCount,
    Jobs: c.jobCount,
    "Lifetime Value": c.revenue,
    Outstanding: c.outstanding ?? 0,
    "Last Activity": c.lastActivity ? new Date(c.lastActivity).toISOString().slice(0, 10) : "",
  }));
}
