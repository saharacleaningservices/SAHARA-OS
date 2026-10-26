import { db } from "@/lib/db";
import { normalizeMobile } from "@/server/customer-db";

export type CustomerRow = {
  /** Normalized 10-digit mobile — the one key per contact. */
  mobile: string;
  name: string;
  leadCount: number;
  jobCount: number;
  revenue: number;
  lastActivity: Date;
  area?: string | null;
  outstanding?: number;
  source?: string | null;
  imported?: boolean;
  contactType: string;
  customerNumber?: string | null;
  isRepeat: boolean;
  siteCount: number;
  alternateMobile?: string | null;
  /** Lower-case site labels + addresses, for search only (never sent to the browser). */
  siteText: string;
  /** Raw spellings of this mobile found across records — >1 = possible duplicate to review. */
  variants: number;
};

/** One row per contact (normalized mobile) across Leads, Jobs, Payments and
 * the Customer master — server-side only; pages receive just one page of it. */
export async function getCustomersList(): Promise<CustomerRow[]> {
  const [leads, jobs, payments, masters] = await Promise.all([
    db.lead.findMany({
      where: { deletedAt: null },
      select: { mobile: true, name: true, createdAt: true, alternateMobile: true },
    }),
    db.job.findMany({
      where: { deletedAt: null },
      select: { customerMobile: true, customerName: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { deletedAt: null, status: "PAID" },
      select: { clientMobile: true, paidAmount: true },
    }),
    db.customer.findMany({
      select: {
        mobile: true, name: true, area: true, outstandingBalance: true, lastServiceDate: true, source: true, createdAt: true,
        importBatchId: true, contactType: true, customerNumber: true, isRepeat: true, alternateMobile: true,
        sites: { select: { label: true, address: true, area: true } },
      },
    }),
  ]);

  const byMobile = new Map<string, CustomerRow & { raw: Set<string> }>();
  function touch(rawMobile: string | null, name: string, at: Date) {
    const key = normalizeMobile(rawMobile);
    if (!key) return null;
    let row = byMobile.get(key);
    if (!row) {
      row = { mobile: key, name, leadCount: 0, jobCount: 0, revenue: 0, lastActivity: at, contactType: "CUSTOMER", isRepeat: false, siteCount: 0, siteText: "", variants: 0, raw: new Set() };
      byMobile.set(key, row);
    } else if (at > row.lastActivity) {
      row.lastActivity = at;
      row.name = name || row.name;
    }
    if (rawMobile) row.raw.add(rawMobile.trim());
    return row;
  }

  for (const l of leads) {
    const row = touch(l.mobile, l.name, l.createdAt);
    if (row) {
      row.leadCount += 1;
      row.alternateMobile = row.alternateMobile ?? l.alternateMobile;
    }
  }
  for (const j of jobs) {
    const row = touch(j.customerMobile, j.customerName, j.createdAt);
    if (row) row.jobCount += 1;
  }
  for (const p of payments) {
    const row = byMobile.get(normalizeMobile(p.clientMobile) ?? "");
    if (row) row.revenue += p.paidAmount;
  }
  for (const c of masters) {
    const row = touch(c.mobile, c.name, c.lastServiceDate ?? c.createdAt);
    if (!row) continue;
    row.name = c.name || row.name; // the master name is the curated one
    row.imported = !!c.importBatchId;
    row.area = row.area ?? c.area ?? c.sites[0]?.area ?? null;
    row.outstanding = (row.outstanding ?? 0) + (c.outstandingBalance ?? 0);
    row.source = row.source ?? c.source;
    row.contactType = c.contactType || "CUSTOMER";
    row.customerNumber = c.customerNumber;
    row.isRepeat = row.isRepeat || c.isRepeat;
    row.alternateMobile = c.alternateMobile ?? row.alternateMobile;
    row.siteCount = c.sites.length;
    row.siteText = c.sites.map((s) => `${s.label ?? ""} ${s.address} ${s.area ?? ""}`).join(" ").toLowerCase();
  }

  return Array.from(byMobile.values())
    .map(({ raw, ...row }) => ({ ...row, variants: raw.size, isRepeat: row.isRepeat || row.jobCount >= 2 }))
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
}

export const CUSTOMER_FILTERS = ["ALL", "CUSTOMER", "REPEAT", "BROKER", "INTERIOR_DESIGNER", "VENDOR", "AMC_CLIENT", "CORPORATE", "ARCHITECT", "SOCIETY", "ACTIVE", "INACTIVE", "DUPLICATES"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];
export type CustomerFilters = { q?: string; filter?: string; page?: number; pageSize?: number };

const ACTIVE_DAYS = 180;

function matchesFilter(c: CustomerRow, filter: string, activeSince: number) {
  switch (filter) {
    case "CUSTOMER": return c.contactType === "CUSTOMER";
    case "REPEAT": return c.isRepeat;
    case "BROKER": case "ARCHITECT": case "INTERIOR_DESIGNER": case "VENDOR": case "AMC_CLIENT": case "SOCIETY": case "CORPORATE": return c.contactType === filter;
    case "ACTIVE": return c.lastActivity.getTime() >= activeSince;
    case "INACTIVE": return c.lastActivity.getTime() < activeSince;
    case "DUPLICATES": return c.variants > 1;
    default: return true;
  }
}

/** Search + filter + one page, all on the server (4,000+ contacts never reach the browser). */
export async function getCustomersPage(f: CustomerFilters) {
  const all = await getCustomersList();
  const q = (f.q ?? "").trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const filter = CUSTOMER_FILTERS.includes((f.filter ?? "ALL") as CustomerFilter) ? (f.filter ?? "ALL") : "ALL";
  const activeSince = Date.now() - ACTIVE_DAYS * 86400000;

  const searched = q
    ? all.filter((c) =>
        `${c.name} ${c.area ?? ""} ${c.customerNumber ?? ""}`.toLowerCase().includes(q) ||
        c.siteText.includes(q) ||
        (digits.length >= 3 && (c.mobile.includes(digits) || (c.alternateMobile ?? "").replace(/\D/g, "").includes(digits))),
      )
    : all;

  const counts = Object.fromEntries(CUSTOMER_FILTERS.map((k) => [k, searched.filter((c) => matchesFilter(c, k, activeSince)).length])) as Record<CustomerFilter, number>;
  const filtered = searched.filter((c) => matchesFilter(c, filter, activeSince));
  const pageSize = Math.min(Math.max(f.pageSize ?? 25, 1), 100_000);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(f.page ?? 1, 1), totalPages);
  const outstanding = all.reduce((s, c) => s + (c.outstanding ?? 0), 0);
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    allCount: all.length,
    outstanding,
    counts,
    page,
    totalPages,
    filter,
  };
}

/** Every lead, job, payment, photo and review tied to a mobile number (any
 * spelling of it — +91, spaces, leading 0) — the permanent customer history. */
export async function getCustomerHistory(mobile: string) {
  const key = normalizeMobile(mobile) ?? mobile;
  // Narrow by the last 4 digits in SQL, then keep exact normalized matches —
  // finds "+91 90000-00101", "09000000101" and "9000000101" alike.
  const tail = key.slice(-4);
  const same = (m: string | null | undefined) => normalizeMobile(m) === key;
  const [leads, jobs, payments, reviews, master] = await Promise.all([
    db.lead.findMany({
      where: { mobile: { contains: tail }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { timeline: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } },
    }),
    db.job.findMany({
      where: { customerMobile: { contains: tail }, deletedAt: null },
      orderBy: { scheduledDate: "desc" },
      include: { photos: { orderBy: { uploadedAt: "desc" } } },
    }),
    db.payment.findMany({ where: { clientMobile: { contains: tail }, deletedAt: null }, orderBy: { dueDate: "desc" } }),
    db.review.findMany({ where: { customerMobile: { contains: tail } }, orderBy: { createdAt: "desc" } }),
    db.customer.findUnique({ where: { mobile: key }, include: { sites: { orderBy: { updatedAt: "desc" } } } }).catch(() => null),
  ]);

  return {
    leads: leads.filter((l) => same(l.mobile)),
    jobs: jobs.filter((j) => same(j.customerMobile)),
    payments: payments.filter((p) => same(p.clientMobile)),
    reviews: reviews.filter((r) => same(r.customerMobile)),
    master,
  };
}
