// Role-based payload redaction (owner rule 2026-10-08). Roles without
// canSeeCustomerContact never receive customer mobile / alternate / WhatsApp /
// email; roles without canViewJobAmount never receive amounts, advance,
// payments or package prices. Applied on the server BEFORE data reaches a
// client component, PDF or JSON response — hiding in the UI alone is not
// protection. Database values are never changed.
import { canSeeCustomerContact, canViewJobAmount } from "@/lib/permissions";

/** Package lines keep names / quantities for the crew, but no prices. */
function stripLinePrices(json: string | null | undefined): string | null {
  if (!json) return json ?? null;
  try {
    const raw = JSON.parse(json);
    const lines = Array.isArray(raw) ? raw : Array.isArray(raw?.lines) ? raw.lines : null;
    if (!lines) return null;
    const clean = lines.map((l: Record<string, unknown>) => ({ ...l, unitPrice: 0, price: 0, amount: 0 }));
    return JSON.stringify(Array.isArray(raw) ? clean : { ...raw, lines: clean, discount: 0 });
  } catch {
    return null;
  }
}

type Money = { amount?: number | null; paidAmount?: number | null };

/** Free-text notes: withhold customer numbers and rupee amounts (e.g. booking summaries "= ₹5,500"). */
export function maskText(text: string | null | undefined, opts: { contact: boolean; money: boolean }): string | null {
  if (text == null) return null;
  let t = text;
  if (!opts.contact) t = t.replace(/(\+?91[\s-]?)?\b\d{10}\b/g, "(number hidden)");
  if (!opts.money) t = t.replace(/\s*=?\s*(₹|Rs\.?|INR)\s?[\d,]+(\.\d+)?(\/-)?/gi, "");
  return t;
}
const notesFor = (o: Record<string, unknown>, role: string) => {
  const opts = { contact: canSeeCustomerContact(role), money: canViewJobAmount(role) };
  if (opts.contact && opts.money) return {};
  return Object.fromEntries(["notes", "scopeOfWork"].filter((k) => typeof o[k] === "string").map((k) => [k, maskText(o[k] as string, opts)]));
};

export function redactJob<T extends Record<string, unknown>>(job: T, role: string): T {
  let out: Record<string, unknown> = { ...job, ...notesFor(job, role) };
  if (!canSeeCustomerContact(role)) {
    out = { ...out, customerMobile: "", alternateMobile: null, ...("customerEmail" in out ? { customerEmail: null } : {}) };
  }
  if (!canViewJobAmount(role)) {
    out = {
      ...out,
      jobValue: 0,
      discountAmount: null,
      serviceItems: stripLinePrices(out.serviceItems as string | null),
      // Public token opens the customer's quotation / invoice / payment pages.
      ...("publicToken" in out ? { publicToken: null } : {}),
      ...(Array.isArray(out.payments) ? { payments: (out.payments as Money[]).map((p) => ({ ...p, amount: 0, paidAmount: 0 })) } : {}),
    };
  }
  return out as T;
}

export function redactLead<T extends Record<string, unknown>>(lead: T, role: string): T {
  let out: Record<string, unknown> = { ...lead, ...notesFor(lead, role) };
  if (!canSeeCustomerContact(role)) {
    out = { ...out, mobile: "", alternateMobile: null, whatsapp: null, email: null };
  }
  if (!canViewJobAmount(role)) {
    out = {
      ...out,
      quoteAmount: null,
      advanceAmount: null,
      discountAmount: null,
      paymentMode: null,
      serviceItems: stripLinePrices(out.serviceItems as string | null),
      ...("estimatedValue" in out ? { estimatedValue: null } : {}),
    };
  }
  return out as T;
}

/** Customer number shown to restricted roles in place of the real one. */
export const HIDDEN_CONTACT = "Hidden";
