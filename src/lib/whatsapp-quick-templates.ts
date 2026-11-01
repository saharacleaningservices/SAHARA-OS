// One-tap WhatsApp message templates for office staff (Lead + Job cards). These open wa.me with the text prefilled;
// they are NOT Cloud-API template messages. Pure functions — safe on server and client.

export const GOOGLE_REVIEW_FALLBACK = "https://g.page/r/CYJ9szEiGaN4EBE/review";

export type QuickTemplateKey = "QUOTE_FOLLOWUP" | "PAYMENT_REMINDER" | "ON_THE_WAY" | "REVIEW_REQUEST";

export type QuickTemplateContext = {
  name?: string;
  service?: string;
  /** Amount to mention (₹). Payment reminder uses it; omitted when unknown. */
  amount?: number | null;
  /** Human date/slot text, e.g. "today, 10:00 AM – 12:00 PM". */
  when?: string;
  reviewUrl?: string;
};

export const QUICK_TEMPLATES: { key: QuickTemplateKey; label: string }[] = [
  { key: "QUOTE_FOLLOWUP", label: "Quote follow-up" },
  { key: "PAYMENT_REMINDER", label: "Payment reminder" },
  { key: "ON_THE_WAY", label: "On-the-way" },
  { key: "REVIEW_REQUEST", label: "Review request" },
];

const first = (n?: string) => (n ?? "").trim().split(/\s+/)[0] || "there";
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function buildQuickTemplate(key: QuickTemplateKey, c: QuickTemplateContext): string {
  const hi = `Hi ${first(c.name)}, `;
  const svc = c.service ? ` for ${c.service}` : "";
  switch (key) {
    case "QUOTE_FOLLOWUP":
      return `${hi}this is Sahara Cleaning Services. Following up on the quotation we shared${svc}. Happy to answer any questions or lock a convenient slot — just reply here.`;
    case "PAYMENT_REMINDER":
      return `${hi}a gentle reminder from Sahara Cleaning Services: ${c.amount && c.amount > 0 ? `${inr(c.amount)} is` : "the payment is"} pending${svc}. You can pay by UPI or bank transfer and share the screenshot here. Thank you!`;
    case "ON_THE_WAY":
      return `${hi}our Sahara team is on the way${svc}${c.when ? ` (${c.when})` : ""}. Please keep access ready. For anything urgent call 7083347130.`;
    case "REVIEW_REQUEST":
      return `${hi}thank you for choosing Sahara Cleaning Services! If you were happy with the service, a quick Google review means a lot to us: ${c.reviewUrl || GOOGLE_REVIEW_FALLBACK}`;
  }
}
