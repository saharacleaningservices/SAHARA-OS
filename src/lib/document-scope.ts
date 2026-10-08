// Scope notes for quotations / invoices, built automatically from what was sold —
// no manual re-entry. Uses only approved content: the room-wise full-house scope
// (service-scope.ts) and each price-master item's own scope / rule text.
import { PRICING_MASTER } from "@/lib/pricing-master";
import { parsePackage } from "@/lib/package-calc";
import { CUSTOMER_REQUIREMENTS, HOME_DURATION, homePleaseNote, homeScopeByArea, tierFromPackage } from "@/lib/service-scope";

export function documentScope(input: {
  service: string;
  packageName?: string | null;
  serviceVariant?: string | null;
  serviceItems?: string | null;
  scopeOfWork?: string | null;
  scheduleDate?: string | null;
}): { notes: string[]; kindlyNote: string[] } {
  const notes: string[] = [];
  const kindlyNote: string[] = [];
  const manual = (input.scopeOfWork ?? "").trim();
  if (manual) notes.push(manual);

  const lines = parsePackage(input.serviceItems).lines;
  const baseLine = lines.find((l) => l.group === "PREMIUM" || l.group === "PLATINUM");
  const tier =
    input.service === "HOME_DEEP_CLEANING" || baseLine
      ? tierFromPackage(baseLine?.name, input.packageName, input.serviceVariant)
      : null;

  if (tier && !manual) {
    notes.push(
      `Full house deep cleaning (${tier}): ` +
        homeScopeByArea(tier)
          .map((a) => `${a.area}: ${a.items.map((i) => i.item.toLowerCase()).join(", ")}`)
          .join("; ") +
        ".",
    );
    notes.push(`Working time: ${HOME_DURATION}.`);
    kindlyNote.push(...homePleaseNote(tier));
  }

  // Customized / add-on services: each item's approved scope / rule.
  for (const l of lines) {
    if (l.group === "PREMIUM" || l.group === "PLATINUM") continue;
    const item = PRICING_MASTER.find((p) => p.contentId === l.contentId);
    const detail = [item?.scope, item?.rule].filter(Boolean).join(" · ");
    notes.push(`${l.name}${l.qty > 1 ? ` × ${l.qty}` : ""}${l.complimentary ? " (complimentary)" : ""}${detail ? ` — ${detail}` : ""}`);
  }

  if (input.scheduleDate) notes.push(`Schedule date: ${input.scheduleDate}`);
  if (tier || lines.length) kindlyNote.push(`Customer to arrange: ${CUSTOMER_REQUIREMENTS.map((r) => r.replace(/\.$/, "").toLowerCase()).join("; ")}.`);
  return { notes, kindlyNote };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const three = (n: number) => `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? " " : ""}` : ""}${n % 100 ? two(n % 100) : ""}`;

/** Indian-system amount in words: 7000 → "Seven Thousand Rupees". */
export function rupeesInWords(amount: number): string {
  const total = Math.round(Math.max(0, amount) * 100); // paise — exact, no whole-rupee rounding
  let n = Math.floor(total / 100);
  const paise = total % 100;
  const paiseWords = paise ? ` and ${two(paise)} Paise` : "";
  if (n === 0) return paise ? `${two(paise)} Paise` : "Zero Rupees";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `${parts.join(" ")} Rupees${paiseWords}`;
}

type StoredLine = { name: string; description: string; amount: number };
export type BillTableRow = { name: string; detail?: string; qty: number; rate: number; disc: number; total: number };

/**
 * Quotation / invoice table rows from the stored line items (the exact amounts
 * already saved — nothing is re-priced). Qty × rate comes from the stored
 * description ("2 × ₹599 per bathroom"); complimentary lines show their value
 * as a 100% discount; with one chargeable line the document discount sits on
 * that row (MyBillBook style), otherwise in the subtotal band.
 */
export function billTable(lines: StoredLine[], discount: number) {
  const n = (v: string) => Number(v.replace(/,/g, "")) || 0;
  const rows: BillTableRow[] = lines.map((l) => {
    const desc = (l.description ?? "").replace(/\s*·\s*Scope:[\s\S]*$/, "").trim();
    const comp = /\(Complimentary\)\s*$/.test(l.name);
    const qr = /^(\d+)\s*×\s*₹\s*([\d,]+(?:\.\d+)?)\s*(.*)$/.exec(desc);
    const qty = qr ? Number(qr[1]) : 1;
    if (comp) {
      const value = n((/value ₹([\d,]+)/.exec(desc) ?? [])[1] ?? "0");
      const name = l.name.replace(/\s*×\s*\d+\s*\(Complimentary\)\s*$/, " (Complimentary)");
      const cq = Number((/×\s*(\d+)/.exec(l.name) ?? [])[1] ?? 1) || 1;
      return { name, detail: "Complimentary", qty: cq, rate: value / cq, disc: value, total: 0 };
    }
    const name = l.name.replace(/\s*×\s*\d+\s*$/, "");
    const rate = qr ? n(qr[2]) : l.amount;
    const detail = qr ? qr[3] || undefined : desc && !desc.startsWith(name) ? desc : undefined;
    return { name, detail, qty, rate: qty ? rate : l.amount, disc: 0, total: l.amount };
  });
  const chargeable = rows.filter((r) => r.total > 0);
  let subDisc = rows.reduce((t, r) => t + r.disc, 0);
  let subTotal = rows.reduce((t, r) => t + r.total, 0);
  if (discount > 0) {
    if (chargeable.length === 1) {
      chargeable[0].disc += discount;
      chargeable[0].total -= discount;
    }
    subDisc += discount;
    subTotal -= discount;
  }
  return { rows, subtotal: { qty: rows.reduce((t, r) => t + r.qty, 0), disc: subDisc, total: subTotal } };
}
