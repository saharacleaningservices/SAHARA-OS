// MyBillBook full-history sync (owner 2026-11-06) — pure rules. No database, no network.
// A party is attached to a CRM customer ONLY on a perfect match: same mobile AND same name, and no other MyBillBook party sharing that
// mobile. Everything else goes to the Manual Review Queue. History is never auto-attached on a conflict.

const HONORIFIC = /\b(mr|mrs|ms|dr|miss|shri|smt|sir|madam|mam|bhai)\b\.?/g;
const BADGES = /review duplicate|interior designer|architect|broker|society|corporate|customer/g;

export function nameTokens(s: string | null | undefined): Set<string> {
  const n = String(s ?? "").toLowerCase().replace(BADGES, " ").replace(HONORIFIC, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return new Set(n.split(" ").filter((t) => t.length > 1));
}

/** 0..1 — share of the shorter name's words found in the other name (a word also counts when both start with the same 4 letters). */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const A = nameTokens(a), B = nameTokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t) || [...B].some((u) => u.length > 3 && t.length > 3 && u.startsWith(t.slice(0, 4)))) hit++;
  return hit / Math.min(A.size, B.size);
}

export type PartyDecision = "CREATE_AND_ATTACH" | "ATTACH" | "NAME_CONFLICT" | "PARTIAL_MATCH" | "MULTI_PARTY" | "NEW_MULTI_PARTY" | "INVALID_MOBILE" | "PROTECTED";

export function decideParty(input: { mobileValid: boolean; protectedNumber: boolean; memberCount: number; crmName: string | null; mbbNames: string[] }): PartyDecision {
  if (input.protectedNumber) return "PROTECTED";
  if (!input.mobileValid) return "INVALID_MOBILE";
  if (input.crmName === null) return input.memberCount > 1 ? "NEW_MULTI_PARTY" : "CREATE_AND_ATTACH";
  if (input.memberCount > 1) return "MULTI_PARTY";
  const sim = Math.max(0, ...input.mbbNames.map((n) => nameSimilarity(n, input.crmName)));
  return sim >= 0.99 ? "ATTACH" : sim >= 0.5 ? "PARTIAL_MATCH" : "NAME_CONFLICT";
}

export type DocType = "SALES_INVOICE" | "QUOTATION" | "PROFORMA" | "PAYMENT_IN" | "EXPENSE" | "CREDIT_NOTE" | "OTHER";

export function docTypeOf(mbbType: string): DocType {
  switch (mbbType) {
    case "sales_invoice": return "SALES_INVOICE";
    case "quotation": return "QUOTATION";
    case "proforma": return "PROFORMA";
    case "payment_in": return "PAYMENT_IN";
    case "expense": return "EXPENSE";
    case "credit_memo": return "CREDIT_NOTE";
    default: return "OTHER";
  }
}

/** Status text kept in MybillbookInvoice.status. Invoices: Paid when nothing remains (a settled MyBillBook invoice is Paid/Closed in the CRM). */
export function statusOf(doc: DocType, remaining: number): string {
  if (doc === "SALES_INVOICE" || doc === "PROFORMA") return remaining <= 0.005 ? "Paid" : "Unpaid";
  if (doc === "QUOTATION") return "Quotation";
  if (doc === "PAYMENT_IN") return "Received";
  if (doc === "EXPENSE") return "Paid";
  if (doc === "CREDIT_NOTE") return "Credit";
  return "Recorded";
}

export const segmentOf = (dataset: "B2C" | "GST"): "B2C" | "B2B" => (dataset === "GST" ? "B2B" : "B2C");

/** Combine the customer's current segment with the book a record came from. */
export function mergeSegment(current: string | null | undefined, incoming: "B2C" | "B2B"): "B2C" | "B2B" | "BOTH" {
  if (!current) return incoming;
  if (current === incoming) return incoming;
  return "BOTH";
}
