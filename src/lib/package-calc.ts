// Package Calculator — ONE calculation used by the header Package Calculator,
// New Lead → Customized Service, Quote, Confirm Booking, Job and Invoice.
// Prices come from the live pricing master (Super Admin → Pricing & Packages);
// there is no second price list. Pure functions: safe on client and server.

import type { FestivalWindow, PriceGroup, PriceItem } from "@/lib/pricing-master";

export type PackageLine = {
  id: string;
  group: PriceGroup | "OTHER";
  contentId: string | null;
  name: string;
  unit?: string | null;
  qty: number;
  unitPrice: number;
  /** Given free: shown to the customer with its value, never charged or discounted. */
  complimentary?: boolean;
};
export type PackageDraft = { lines: PackageLine[]; discount: number };

export const EMPTY_PACKAGE: PackageDraft = { lines: [], discount: 0 };

const r2 = (n: number) => Math.round(n * 100) / 100;
export const lineAmount = (l: Pick<PackageLine, "qty" | "unitPrice">) => r2(Math.max(0, l.qty) * Math.max(0, l.unitPrice));

/**
 * subtotal = Actual value of the CHARGEABLE lines; discount applies to it only;
 * complimentary = value of the free lines (shown, never charged, never discounted);
 * final = subtotal − discount.
 */
export function packageTotals(d: PackageDraft) {
  const subtotal = r2(d.lines.filter((l) => !l.complimentary).reduce((s, l) => s + lineAmount(l), 0));
  const complimentary = r2(d.lines.filter((l) => l.complimentary).reduce((s, l) => s + lineAmount(l), 0));
  const discount = r2(Math.min(Math.max(0, d.discount || 0), subtotal));
  return { subtotal, complimentary, discount, final: r2(subtotal - discount) };
}

/** Discount presets offered in the calculator (percent of the chargeable value). */
export const DISCOUNT_PRESETS = [5, 10, 20] as const;
export const percentDiscount = (subtotal: number, pct: number) => Math.round((Math.max(0, subtotal) * pct) / 100);

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
  return d.lines.map((l) => {
    const name = l.qty > 1 || l.unit ? `${l.name} × ${l.qty}` : l.name;
    return l.complimentary
      ? { name: `${name} (Complimentary)`, description: `Complimentary — value ₹${lineAmount(l).toLocaleString("en-IN")}`, amount: 0 }
      : { name, description: `${l.qty} × ₹${l.unitPrice.toLocaleString("en-IN")}${l.unit ? ` ${l.unit}` : ""}`, amount: lineAmount(l) };
  });
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
        ...(l.complimentary ? { complimentary: true } : {}),
      }));
    return { lines, discount: Math.max(0, Number(discount) || 0) };
  } catch {
    return { lines: [], discount: discount ?? 0 };
  }
}

export const serializeLines = (d: PackageDraft) =>
  JSON.stringify(
    d.lines.map(({ id, group, contentId, name, unit, qty, unitPrice, complimentary }) => ({ id, group, contentId, name, unit: unit ?? null, qty, unitPrice, ...(complimentary ? { complimentary: true } : {}) })),
  );

/**
 * Server-side price guard. Roles without pricing rights (anyone but Super Admin /
 * Accounts) always get the pricing-master unit price and no discount, whatever
 * the browser sent. Lines whose service is no longer in the master are dropped
 * for those roles. Returns the cleaned draft.
 */
export function enforcePricing(d: PackageDraft, items: PriceItem[], canEditPrice: boolean, festivals: FestivalWindow[] = []): PackageDraft {
  const byId = new Map(items.map((i) => [i.contentId, i]));
  // Approved festival prices are master prices too — any role may quote them.
  const festivalPrice = (contentId: string, price: number) => festivals.some((f) => f.prices[contentId] === price);
  const lines = d.lines
    .filter((l) => l.qty > 0)
    .flatMap((l) => {
      const master = l.contentId ? byId.get(l.contentId) : undefined;
      if (canEditPrice) return [{ ...l, name: master?.name ?? l.name, unit: master?.unit ?? l.unit ?? null }];
      if (!master || master.price == null) return [];
      const unitPrice = festivalPrice(master.contentId, l.unitPrice) ? l.unitPrice : master.price;
      // Complimentary items are a pricing concession — Super Admin / Accounts only.
      return [{ ...l, name: master.name, unit: master.unit ?? null, unitPrice, group: master.group, complimentary: false }];
    })
    .slice(0, 40);
  return { lines, discount: canEditPrice ? d.discount : 0 };
}

export const canEditPackagePricing = (role?: string | null) => role === "ADMIN" || role === "ACCOUNTS";
