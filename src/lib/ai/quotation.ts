// Local, deterministic quotation drafting — no external AI calls. Takes a
// real lead record and produces a suggested line-item breakdown and a
// ready-to-send WhatsApp message, using the same pricing rules staff would
// apply manually.
import { SERVICE_LABELS, COMPANY } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { SERVICE_BASE_PRICE } from "./pricing";

export type QuotationLineItem = { name: string; description: string; amount: number };

export type QuotationDraft = {
  lineItems: QuotationLineItem[];
  subTotal: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  message: string;
};

export function draftQuotation(lead: {
  name: string;
  service: string;
  area: string;
  quoteAmount?: number | null;
}): QuotationDraft {
  const label = SERVICE_LABELS[lead.service] ?? lead.service;
  const base = Math.max(
    lead.quoteAmount ?? SERVICE_BASE_PRICE[lead.service] ?? COMPANY.minimumJobValue,
    COMPANY.minimumJobValue
  );

  const lineItems: QuotationLineItem[] = [
    { name: label, description: `${label} — ${lead.area}`, amount: base },
  ];
  const subTotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const gstPercent = 0;
  const gstAmount = Math.round((subTotal * gstPercent) / 100);
  const total = subTotal + gstAmount;

  const message = [
    `Hi ${lead.name}, thank you for reaching out to ${COMPANY.name}!`,
    ``,
    `Here's your quote for *${label}* at ${lead.area}:`,
    `• ${label} — ${formatINR(base)}`,
    `Total: ${formatINR(total)}`,
    ``,
    `This quote is valid for 7 days. 50% advance confirms your booking; the balance is due on completion.`,
    `Reply here or call us on ${COMPANY.phones[0]} to confirm — we'd love to get you booked in!`,
  ].join("\n");

  return { lineItems, subTotal, gstPercent, gstAmount, total, message };
}
