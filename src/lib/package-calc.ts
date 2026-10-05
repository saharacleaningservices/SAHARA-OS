// Package Calculator — ONE calculation used by the header Package Calculator,
// New Lead → Customized Service, Quote, Confirm Booking, Job and Invoice.
// Prices come from the live pricing master (Super Admin → Pricing & Packages);
// there is no second price list. Pure functions: safe on client and server.

import type { PriceGroup, PriceItem } from "@/lib/pricing-master";

export type PackageLine = {
  id: string;
  group: PriceGroup | "OTHER";
  contentId: string | null;
  name: string;
  unit?: string | null;
  qty: number;
  unitPrice: number;
};
export type PackageDraft = { lines: PackageLine[]; discount: number };

export const EMPTY_PACKAGE: PackageDraft = { lines: [], discount: 0 };

const r2 = (n: number) => Math.round(n * 100) / 100;
export const lineAmount = (l: Pick<PackageLine, "qty" | "unitPrice">) => r2(Math.max(0, l.qty) * Math.max(0, l.unitPrice));

export function packageTotals(d: PackageDraft) {
  const subtotal = r2(d.lines.reduce((s, l) => s + lineAmount(l), 0));
  const discount = r2(Math.min(Math.max(0, d.discount || 0), subtotal));
  return { subtotal, discount, final: r2(subtotal - discount) };
}

/** Category groups shown in the calculator (base home packages are chosen separately). */
export const SERVICE_GROUPS: { group: PriceGroup; label: string }[] = [
  { group: "CUSTOMISED", label: "Customized services" },
  { group: "COMBO", label: "Combo / add-ons" },
  { group: "PEST", label: "Pest control" },
  { group: "PAINTING", label: "Painting" },
  { group: "COMMERCIAL", label: "Commercial" },
];
export const BASE_GROUPS: PriceGroup[] = ["PREMIUM", "PLATINUM"];

/** Same service + same qty + same price already present → an accidental duplicate row. */
export function isDuplicateLine(lines: PackageLine[], c: Pick<PackageLine, "contentId" | "name" | "qty" | "unitPrice">, exceptId?: string) {
  return lines.some((l) => l.id !== exceptId && (l.contentId ?? l.name) === (c.contentId ?? c.name) && l.qty === c.qty && l.unitPrice === c.unitPrice);
}

export function newLineFromItem(item: PriceItem, id: string): PackageLine {
  return { id, group: item.group, contentId: item.contentId, name: item.name, unit: item.unit ?? null, qty: Math.max(1, item.minQty ?? 1), unitPrice: item.price ?? 0 };
}

/** Quote / invoice line items ({name, description, amount}). */
export function packageToQuoteItems(d: PackageDraft) {
  return d.lines.map((l) => ({
    name: l.qty > 1 || l.unit ? `${l.name} × ${l.qty}` : l.name,
    description: `${l.qty} × ₹${l.unitPrice.toLocaleString("en-IN")}${l.unit ? ` ${l.unit}` : ""}`,
    amount: lineAmount(l),
  }));
}

/** Short human summary (no prices) — used for staff-visible scope. */
export const packageSummary = (d: PackageDraft) => d.lines.map((l) => (l.qty > 1 || l.unit ? `${l.name} × ${l.qty}` : l.name));

export function parsePackage(json: string | null | undefined, discount?: number | null): PackageDraft {
  if (!json) return { lines: [], discount: discount ?? 0 };
  try {
    const raw = JSON.parse(json) as Partial<PackageLine>[];
    const lines = (Array.isArray(raw) ? raw : [])
      .filter((l) => l && typeof l.name === "string")
      .map((l, i) => ({
        id: String(l.id ?? `l${i}`),
        group: (l.group ?? "OTHER") as PackageLine["group"],
        contentId: l.contentId ?? null,
        name: String(l.name),
        unit: l.unit ?? null,
        qty: Math.max(0, Number(l.qty) || 0),
        unitPrice: Math.max(0, Number(l.unitPrice) || 0),
      }));
    return { lines, discount: Math.max(0, Number(discount) || 0) };
  } catch {
    return { lines: [], discount: discount ?? 0 };
  }
}

export const serializeLines = (d: PackageDraft) =>
  JSON.stringify(d.lines.map(({ id, group, contentId, name, unit, qty, unitPrice }) => ({ id, group, contentId, name, unit: unit ?? null, qty, unitPrice })));

/**
 * Server-side price guard. Roles without pricing rights (anyone but Super Admin /
 * Accounts) always get the pricing-master unit price and no discount, whatever
 * the browser sent. Lines whose service is no longer in the master are dropped
 * for those roles. Returns the cleaned draft.
 */
export function enforcePricing(d: PackageDraft, items: PriceItem[], canEditPrice: boolean): PackageDraft {
  const byId = new Map(items.map((i) => [i.contentId, i]));
  const lines = d.lines
    .filter((l) => l.qty > 0)
    .flatMap((l) => {
      const master = l.contentId ? byId.get(l.contentId) : undefined;
      if (canEditPrice) return [{ ...l, name: master?.name ?? l.name, unit: master?.unit ?? l.unit ?? null }];
      if (!master || master.price == null) return [];
      return [{ ...l, name: master.name, unit: master.unit ?? null, unitPrice: master.price, group: master.group }];
    })
    .slice(0, 40);
  return { lines, discount: canEditPrice ? d.discount : 0 };
}

export const canEditPackagePricing = (role?: string | null) => role === "ADMIN" || role === "ACCOUNTS";
