import { classifyTouch } from "@/lib/attribution";

// Lead Origin (owner 2026-11-01): the one label staff see on every lead / quotation / invoice for where the customer came from.
//   GMB Magarpatta · GMB Mohammadwadi · Google Ads · Meta Ads · Direct Web  (+ honest fallbacks, never a guess)
// Derived from the UTM / click-id data the booking form already captures (src/lib/attribution.ts) plus the business line the
// enquiry arrived on. GMB "Book online" links carry utm_medium=magarpatta_branch | mohammadwadi_branch (src/config/pune-seo-matrix.ts).

export const LEAD_ORIGINS = ["GMB Magarpatta", "GMB Mohammadwadi", "Google Ads", "Meta Ads", "Direct Web", "WhatsApp", "Phone Call", "Other"] as const;
export type LeadOrigin = (typeof LEAD_ORIGINS)[number];

/** Branch the work belongs to for isolation: Magarpatta (Main-API line) vs Mohammadwadi (Shoyab-GMB line). */
export type BranchTag = "Magarpatta" | "Mohammadwadi";

export type OriginInput = {
  source?: string | null; // LeadSource enum
  sourceLine?: string | null;
  acquisitionChannel?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  landingPageUrl?: string | null;
};

const lc = (v?: string | null) => (v ?? "").trim().toLowerCase();

export function branchFromSignals(i: OriginInput): BranchTag | null {
  const med = lc(i.utmMedium);
  if (med.includes("mohammadwadi")) return "Mohammadwadi";
  if (med.includes("magarpatta")) return "Magarpatta";
  if (i.sourceLine === "Shoyab-GMB") return "Mohammadwadi";
  if (i.sourceLine === "Main-API") return "Magarpatta";
  return null;
}

export function leadOrigin(i: OriginInput): LeadOrigin {
  const src = lc(i.utmSource);
  const channel = i.acquisitionChannel || classifyTouch({ source: i.utmSource, medium: i.utmMedium, campaign: i.utmCampaign, gclid: i.gclid, fbclid: i.fbclid, at: i.utmSource || i.gclid || i.fbclid ? "x" : null });
  if (channel === "Google Ads") return "Google Ads";
  if (channel === "Meta Ads") return "Meta Ads";
  if (src === "gmb" || channel === "Google Business Profile" || i.source === "GMB") {
    const b = branchFromSignals(i);
    return b === "Mohammadwadi" ? "GMB Mohammadwadi" : "GMB Magarpatta";
  }
  if (i.source === "WHATSAPP" || channel === "WhatsApp Direct" || channel === "WhatsApp Marketing") return "WhatsApp";
  if (i.source === "CALL" || channel === "Phone Call") return "Phone Call";
  if (i.source === "WEBSITE" || channel === "Website Direct" || channel === "Google Organic/SEO") return "Direct Web";
  return "Other";
}

export const originTone: Record<LeadOrigin, string> = {
  "GMB Magarpatta": "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "GMB Mohammadwadi": "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-400",
  "Google Ads": "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "Meta Ads": "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  "Direct Web": "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  WhatsApp: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400",
  "Phone Call": "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Other: "border-border text-muted-foreground",
};

/** The snapshot stored on a Quotation / Invoice so the origin survives later edits to the lead. */
export function originSnapshot(i: OriginInput): { leadSource: LeadOrigin; branchTag: BranchTag | null } {
  return { leadSource: leadOrigin(i), branchTag: branchFromSignals(i) };
}

/** One printable line for PDF headers: "GMB Magarpatta · Magarpatta branch" (null when the origin was never recorded). */
export function originLineOf(leadSource?: string | null, branchTag?: string | null): string | null {
  if (!leadSource && !branchTag) return null;
  return [leadSource, branchTag ? `${branchTag} branch` : null].filter(Boolean).join(" · ");
}
