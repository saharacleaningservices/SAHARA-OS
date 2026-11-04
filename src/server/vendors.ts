import { db } from "@/lib/db";
import { toE164 } from "@/lib/phone";

export type VendorRow = {
  id: string;
  name: string;
  phone: string;
  phoneE164: string;
  services: string[];
  commissionPct: number;
  notes: string | null;
  active: boolean;
  jobs: number;
  grossTotal: number;
  saharaTotal: number;
  paidTotal: number;
  lastPaidDate: Date | null;
};

export type PayoutRow = {
  id: string;
  vendorName: string;
  service: string | null;
  jobRef: string | null;
  grossAmount: number;
  commissionPct: number;
  saharaShare: number;
  vendorShare: number;
  paidDate: Date;
  mode: string | null;
  expenseLive: boolean;
};

const parseServices = (raw: string | null): string[] => {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
};

export async function getVendorRegistry(): Promise<{ vendors: VendorRow[]; payouts: PayoutRow[] }> {
  const [vendors, payouts] = await Promise.all([
    db.vendor.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.vendorPayout.findMany({ orderBy: { paidDate: "desc" }, include: { vendor: { select: { name: true } } } }),
  ]);
  const expenseIds = payouts.map((p) => p.expenseId).filter((x): x is string => !!x);
  const live = new Set(
    (await db.expense.findMany({ where: { id: { in: expenseIds }, deletedAt: null }, select: { id: true } })).map((e) => e.id),
  );
  // A payout whose Expense was deleted in Purchases & Expenses no longer counts as paid.
  const counted = payouts.filter((p) => p.expenseId && live.has(p.expenseId));
  const byVendor = new Map<string, typeof counted>();
  for (const p of counted) byVendor.set(p.vendorId, [...(byVendor.get(p.vendorId) ?? []), p]);

  return {
    vendors: vendors.map((v) => {
      const list = byVendor.get(v.id) ?? [];
      return {
        id: v.id,
        name: v.name,
        phone: v.phone,
        phoneE164: toE164(v.phone),
        services: parseServices(v.services),
        commissionPct: v.commissionPct,
        notes: v.notes,
        active: v.active,
        jobs: list.length,
        grossTotal: list.reduce((s, p) => s + p.grossAmount, 0),
        saharaTotal: list.reduce((s, p) => s + p.saharaShare, 0),
        paidTotal: list.reduce((s, p) => s + p.vendorShare, 0),
        lastPaidDate: list[0]?.paidDate ?? null,
      };
    }),
    payouts: payouts.slice(0, 100).map((p) => ({
      id: p.id,
      vendorName: p.vendor.name,
      service: p.service,
      jobRef: p.jobRef,
      grossAmount: p.grossAmount,
      commissionPct: p.commissionPct,
      saharaShare: p.saharaShare,
      vendorShare: p.vendorShare,
      paidDate: p.paidDate,
      mode: p.mode,
      expenseLive: !!p.expenseId && live.has(p.expenseId),
    })),
  };
}
