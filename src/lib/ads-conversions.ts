// Google Ads conversion wiring for Sahara's own account (owner 2026-11-12). Browser-only helpers, no secrets:
// the account id and conversion labels are public identifiers that already ship in every gtag payload.
//
//   Booking Lead (Primary)   AW-765890204/H8q6CI72raodEJydmu0C   fired by trackLead() the moment a form is submitted
//   WhatsApp click (Secondary) AW-765890204/fixLCJH2raodEJydmu0C  fired by the click listener, never on page load
//   Call click (Secondary)     AW-765890204/a0-rCJT2raodEJydmu0C  fired by the click listener, never on page load
//
// If a GTM container is also loaded and carries these same conversion tags, remove them there (or leave NEXT_PUBLIC_GTM_ID
// unset) or each action is counted twice.

export const GOOGLE_ADS_ID = "AW-765890204";

export const ADS_CONVERSION_LABELS = {
  lead: "H8q6CI72raodEJydmu0C",
  whatsapp: "fixLCJH2raodEJydmu0C",
  call: "a0-rCJT2raodEJydmu0C",
} as const;
export type AdsConversionKind = keyof typeof ADS_CONVERSION_LABELS;

type Gtag = (...args: unknown[]) => void;

/** Same physical click can be seen by more than one listener (tag shell + page tracker); count it once. */
const CLICK_DEDUPE_MS = 1500;
const lastClickAt: Partial<Record<AdsConversionKind, number>> = {};
const firedTransactions = new Set<string>();

/** "call" for tel: links, "whatsapp" for wa.me / api.whatsapp.com / web.whatsapp.com, else null. */
export function contactKindOfHref(href: string | null | undefined): "call" | "whatsapp" | null {
  const h = (href ?? "").trim().toLowerCase();
  if (h.startsWith("tel:")) return "call";
  if (h.startsWith("whatsapp:")) return "whatsapp";
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|chat\.whatsapp\.com)(\/|\?|$)/.test(h)) return "whatsapp";
  return null;
}

/**
 * Fire one Google Ads conversion. Returns true when a hit was sent. No-ops (returns false) when gtag is not loaded, when
 * the same click was already counted, or when the same lead id was already counted.
 */
export function fireAdsConversion(kind: AdsConversionKind, opts: { transactionId?: string; now?: number } = {}): boolean {
  if (typeof window === "undefined") return false;
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof g !== "function") return false;
  const now = opts.now ?? Date.now();
  if (kind === "lead") {
    const tx = opts.transactionId;
    if (tx) {
      if (firedTransactions.has(tx)) return false;
      firedTransactions.add(tx);
    }
  } else {
    const prev = lastClickAt[kind];
    if (prev !== undefined && now - prev < CLICK_DEDUPE_MS) return false;
    lastClickAt[kind] = now;
  }
  g("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${ADS_CONVERSION_LABELS[kind]}`,
    ...(kind === "lead" && opts.transactionId ? { transaction_id: opts.transactionId } : {}),
  });
  return true;
}

/** Test hook: clears the in-memory de-duplication state. */
export function __resetAdsConversionState() {
  for (const k of Object.keys(lastClickAt)) delete lastClickAt[k as AdsConversionKind];
  firedTransactions.clear();
}
