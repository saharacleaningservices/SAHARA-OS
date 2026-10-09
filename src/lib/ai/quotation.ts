// Local, deterministic quotation drafting — no external AI calls. Takes a
// real lead record and produces a suggested line-item breakdown and a
// ready-to-send WhatsApp message, using the same pricing rules staff would
// apply manually.
import { SERVICE_LABELS, COMPANY } from "@/lib/constants";
import { formatINR } from "@/lib/utils";

export type QuotationLineItem = { name: string; description: string; amount: number };

export type QuotationDraft = {
  lineItems: QuotationLineItem[];
  subTotal: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  message: string;
};

// Individual Cleaning quantity selections have no per-item price — by
// explicit production instruction, office staff price those manually.
// Customized Service items are priced automatically where a rate is
// configured (folded straight into the lead's Estimated Amount, so they're
// NOT listed again here); an item with no configured rate and no unit price
// typed yet is recorded with the distinct "(price to be confirmed)" marker.
// ServiceQuantityFields records these as plain Notes lines (see
// src/components/shared/service-quantity-fields.tsx). This pulls the
// still-unpriced ones back out so quotation generation can list exactly what
// was selected, as $0 "price to be confirmed" line items, without inventing
// a number. "Custom Package —" / "Customizer Package (price to be
// confirmed) —" are kept for backward compatibility with leads saved before
// the display name changed from "Customizer Package" to "Customized
// Service" (2026-09-21).
function selectionLinesFromNotes(notes?: string | null): string[] {
  return (notes ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.startsWith("Custom Package —") ||
        l.startsWith("Individual Cleaning —") ||
        l.startsWith("Customizer Package (price to be confirmed) —") ||
        l.startsWith("Customized Service (price to be confirmed) —")
    );
}

export function draftQuotation(lead: {
  name: string;
  service: string;
  area: string;
  quoteAmount?: number | null;
  notes?: string | null;
}): QuotationDraft {
  const label = SERVICE_LABELS[lead.service] ?? lead.service;
  // No generic fallback price: a draft quote is only priced from the lead's own quote amount
  // (set by staff from the correct BHK/package). Without it the draft carries no number.
  const priced = lead.quoteAmount != null && lead.quoteAmount > 0;
  const base = priced ? (lead.quoteAmount as number) : 0;

  const lineItems: QuotationLineItem[] = [
    { name: label, description: priced ? `${label} — ${lead.area}` : `${label} — ${lead.area} (price to be confirmed — choose the package / inspect first)`, amount: base },
  ];

  const selectionLines = selectionLinesFromNotes(lead.notes);
  for (const line of selectionLines) {
    lineItems.push({ name: line, description: `${line} — price to be confirmed`, amount: 0 });
  }

  const subTotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const gstPercent = 0;
  const gstAmount = Math.round(((subTotal * gstPercent) / 100) * 100) / 100; // exact to the paisa
  const total = subTotal + gstAmount;

  const message = !priced
    ? [
        `Hi ${lead.name}, thank you for reaching out to ${COMPANY.name}!`,
        ``,
        `We've noted your enquiry for *${label}* at ${lead.area}.`,
        `Our team will confirm the right package and price after checking your requirement — no price has been quoted yet.`,
        ``,
        `Reply here or call us on ${COMPANY.phones[0]} and we'll take it from there.`,
      ].join("\n")
    : [
    `Hi ${lead.name}, thank you for reaching out to ${COMPANY.name}!`,
    ``,
    `Here's your quote for *${label}* at ${lead.area}:`,
    `• ${label} — ${formatINR(base)}`,
    ...(selectionLines.length > 0
      ? [``, `Also selected (price to be confirmed):`, ...selectionLines.map((l) => `• ${l}`)]
      : []),
    `Total: ${formatINR(total)}`,
    ``,
    `This quote is valid for 7 days. 50% advance confirms your booking; the balance is due on completion.`,
    `Reply here or call us on ${COMPANY.phones[0]} to confirm — we'd love to get you booked in!`,
  ].join("\n");

  return { lineItems, subTotal, gstPercent, gstAmount, total, message };
}
