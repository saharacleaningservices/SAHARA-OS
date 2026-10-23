// MyBillBook invoice DETAIL (owner 2026-10-23): what a shared invoice link shows to anyone who opens it — service lines, date, total,
// balance, customer name / mobile / address. Pure functions: no database, no network. No login is involved: the link id is the whole key
// (the public page sends it as a `token` header), so nothing secret is read, stored or needed.

export type InvoiceLine = { name: string; qty: number; rate: number; amount: number; description: string | null };

export type InvoiceDetail = {
  invoiceNumber: string;
  invoiceDate: string; // yyyy-mm-dd, as MyBillBook prints it
  partyName: string;
  /** 10 digits, or null when the invoice carries no valid mobile number. */
  partyMobile: string | null;
  partyAddress: string | null;
  lines: InvoiceLine[];
  total: number;
  remaining: number;
  discount: number;
  paymentMode: string | null;
  notes: string | null;
};

/** The id at the end of an invoice link path ("i/116dkox" / "cpp/7qo8tmlxrw" → "116dkox" / "7qo8tmlxrw"). */
export function linkIdOf(invoiceKey: string): string | null {
  const id = invoiceKey.split("/").filter(Boolean).pop() ?? "";
  return /^[A-Za-z0-9_-]{4,40}$/.test(id) ? id : null;
}

/** Headers the public invoice page itself sends; the server answers a bare request with an empty "use a web browser" shell. */
export function embedRequest(linkId: string) {
  return {
    url: `https://mybillbook.in/api/i/cpp/embed/${linkId}`,
    headers: {
      token: linkId,
      Accept: "application/json, text/plain, */*",
      Referer: `https://mybillbook.in/cpp/${linkId}`,
      Origin: "https://mybillbook.in",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    },
  };
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** The page ships the invoice as loadInvoice("<base64 of URL-encoded JSON>"). Returns the JSON, or null when the page has no invoice. */
export function extractInvoicePayload(html: string): Record<string, unknown> | null {
  const m = html.match(/loadInvoice\(\s*"([A-Za-z0-9+/=_-]+)"/);
  if (!m) return null;
  try {
    const json = JSON.parse(decodeURIComponent(Buffer.from(m[1], "base64").toString("utf8")));
    return json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function toMobile10(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

/** Reads the service lines and money out of a payload. Returns null when it is not a sales invoice we understand. */
export function parseInvoiceDetail(payload: Record<string, unknown>): InvoiceDetail | null {
  const v = payload.voucher as Record<string, unknown> | undefined;
  if (!v || typeof v !== "object") return null;
  const items = Array.isArray(v.items) ? (v.items as Record<string, unknown>[]) : [];
  const party = (payload.party ?? {}) as Record<string, unknown>;
  const bill = (v.billing_address ?? {}) as Record<string, unknown>;
  const lines: InvoiceLine[] = items
    .map((i) => ({
      name: str(i.name, 200),
      qty: num(i.quantity),
      rate: num(i.price_per_unit),
      amount: num(i.item_final_amount),
      description: str(i.description, 500) || null,
    }))
    .filter((l) => l.name);
  const address = [str(bill.street_address, 200), str(bill.city, 80), str(bill.pincode, 12)].filter(Boolean).join(", ");
  const invoiceNumber = str(v.invoice_number, 80);
  const invoiceDate = str(v.invoice_date, 10);
  if (!invoiceNumber || !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) return null;
  return {
    invoiceNumber,
    invoiceDate,
    partyName: str(party.name, 160) || str(bill.customer_name, 160),
    partyMobile: toMobile10(party.mobile_number),
    partyAddress: address || null,
    lines,
    total: num(v.total_amount),
    remaining: num(v.remaining_amount),
    discount: num(v.discount),
    paymentMode: str(v.payment_mode, 40) || null,
    notes: str(v.customer_notes, 1500) || null,
  };
}

/** "Full House Deep Cleaning" or "Sofa Cleaning + Carpet Cleaning" — what the customer profile shows as the service. */
export function serviceLabel(lines: InvoiceLine[]): string | null {
  const names = [...new Set(lines.map((l) => l.name))];
  if (!names.length) return null;
  const s = names.join(" + ");
  return s.length > 200 ? `${s.slice(0, 197)}…` : s;
}

/**
 * Does the page agree with the CSV row it was fetched for? A link that now shows a different invoice number or a different total must
 * not overwrite or match anything — it is stored as MISMATCH for an admin to look at.
 */
export function detailAgreesWithRow(d: InvoiceDetail, row: { invoiceNo: string; amount: number }): boolean {
  return d.invoiceNumber === row.invoiceNo && Math.abs(d.total - row.amount) < 1;
}

export type DetailLinkInput = {
  matchStatus: string;
  matchMethod: string | null;
  customerId: string | null;
};
export type DetailLinkDecision =
  | { action: "none" }
  | { action: "attach"; customerId: string }
  | { action: "review"; candidateIds: string[] };

/**
 * The phone number on the invoice is the strongest key the report never had. Rules:
 *  - an admin's own choice (MANUAL) and a CRM-payment match (INVOICE_NO) are never moved;
 *  - not yet attached → attach to the one customer who owns that mobile number;
 *  - attached by NAME to somebody else → do not guess: send to the review list with both people as candidates;
 *  - no customer owns that number → nothing changes (the mobile number is kept and shown on the review list).
 */
export function decideLinkByPhone(row: DetailLinkInput, phoneCustomerId: string | null): DetailLinkDecision {
  if (!phoneCustomerId) return { action: "none" };
  if (row.matchStatus === "MANUAL" || row.matchMethod === "INVOICE_NO" || row.matchMethod === "PHONE") return { action: "none" };
  if (row.matchStatus === "MATCHED" && row.customerId) {
    if (row.customerId === phoneCustomerId) return { action: "none" };
    return { action: "review", candidateIds: [row.customerId, phoneCustomerId] };
  }
  return { action: "attach", customerId: phoneCustomerId };
}

/** The detail saved on an invoice row, read back defensively (a bad value shows nothing rather than breaking the profile). */
export function parseStoredDetail(json: string | null | undefined): InvoiceDetail | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as InvoiceDetail;
    return d && Array.isArray(d.lines) ? d : null;
  } catch {
    return null;
  }
}
