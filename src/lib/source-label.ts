// Lead source labels and WhatsApp "[Ref: …]" codes (owner 2026-11-12: stop WhatsApp / website lead mix-up).
//
//   website button  →  wa.me text gets "[Ref: GOOGLE-G1]"  →  customer sends it  →  webhook parses it  →  Lead.sourceTag
//   Lead.sourceTag  →  label for the CRM / inbox  →  header line on the admin WhatsApp alert
//
// Pure functions only (no database, no DOM) so the browser tagger, the webhook and the tests share one definition.

import { classifyTouch, type Touch } from "@/lib/attribution";
import { campaignNumber, gmbBranchOf, SOURCE_TAG_LABEL, isSourceTag } from "@/lib/source-tags";

export type SourceLabel = { label: string; header: string };

export const DIRECT_LABEL: SourceLabel = { label: "Direct / Repeat Customer", header: "[DIRECT]" };

/** "/services/home-deep-cleaning" → "HOME-DEEP-CLEANING"; "/services/home-deep-cleaning/magarpatta" → "HOME-DEEP-CLEANING-MAGARPATTA"; "/" → "WEB". */
export function slugFromPath(path: string | null | undefined): string {
  const clean = (path ?? "").split(/[?#]/)[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() === "services") parts.shift();
  const slug = parts.join("-").toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50).replace(/-$/, "");
  return slug || "WEB";
}

/** The code a website WhatsApp button appends for this visitor, or null for a direct / untracked visitor (no tag is added then). */
export function refCodeForTouch(touch: Touch | null | undefined, pagePath?: string | null): string | null {
  if (!touch) return null;
  const channel = classifyTouch(touch);
  if (channel === "Google Ads") {
    const n = campaignNumber(touch.campaign, "g");
    return n ? `GOOGLE-G${n}` : "GOOGLE-ADS";
  }
  if (channel === "Meta Ads") {
    const n = campaignNumber(touch.campaign, "m");
    return n ? `META-M${n}` : "META-ADS";
  }
  if (channel === "Google Business Profile") {
    const b = gmbBranchOf(touch.campaign, touch.medium);
    return b === "MAGARPATTA" ? "GMB-MAGARPATTA" : b === "MOHAMMADWADI" ? "GMB-MOHDWADI" : null;
  }
  if (channel === "Google Organic/SEO") {
    // B2B desk pages (/b2b/…, /b2b-housekeeping-pune) share one code so the team can see business enquiries at a glance (owner 2026-11-12).
    if (/^\/b2b(\/|-|$)/i.test((pagePath ?? "").split(/[?#]/)[0] ?? "")) return "SEO-B2B";
    return `SEO-${slugFromPath(touch.landingPage ?? pagePath)}`;
  }
  return null;
}

const REF_RE = /\[\s*Ref\s*:\s*([A-Za-z0-9][A-Za-z0-9-]{1,59})\s*\]/i;

/** The upper-cased code from a message containing "[Ref: CODE]", or null. */
export function parseRefCode(text: string | null | undefined): string | null {
  const m = REF_RE.exec(text ?? "");
  return m ? m[1]!.toUpperCase() : null;
}

/** The message with the "[Ref: …]" marker (and the line break before it) removed — what the team should read as the customer's words. */
export function stripRefCode(text: string): string {
  return text.replace(/\s*\[\s*Ref\s*:\s*[A-Za-z0-9-]{2,60}\s*\]/gi, "").trim();
}

const titleCase = (slug: string) => slug.toLowerCase().split("-").filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");

/** Source tag a "[Ref: …]" code stands for; null for a code Sahara does not issue. */
export function sourceTagForRef(code: string | null | undefined): string | null {
  const c = (code ?? "").toUpperCase();
  if (c === "GMB-MAGARPATTA") return "SRC-GMB-MAGARPATTA";
  if (c === "GMB-MOHDWADI" || c === "GMB-MOHAMMADWADI") return "SRC-GMB-MOHAMMADWADI";
  const g = /^GOOGLE-G([1-7])$/.exec(c);
  if (g) return `SRC-GOOGLE-G${g[1]}`;
  if (c === "GOOGLE-ADS") return "SRC-GOOGLE-ADS";
  const m = /^META-M([1-7])$/.exec(c);
  if (m) return `SRC-META-M${m[1]}`;
  if (c === "META-ADS") return "SRC-META-ADS";
  if (/^SEO-[A-Z0-9-]{1,55}$/.test(c)) return "SRC-ORGANIC-SEO";
  return null;
}

/** CRM / inbox label and WhatsApp-alert header for a stored source tag (landing page names the SEO page). Unknown or empty → Direct. */
export function sourceLabelForTag(tag: string | null | undefined, landingPage?: string | null): SourceLabel {
  const t = (tag ?? "").trim();
  if (!t) return DIRECT_LABEL;
  // Owner 2026-11-13: the alert header reads GBP (Google Business Profile). The customer-facing "[Ref: GMB-…]" codes are unchanged.
  if (t === "SRC-GMB-MAGARPATTA") return { label: "GMB - Magarpatta", header: "[GBP-MAGARPATTA]" };
  if (t === "SRC-GMB-MOHAMMADWADI") return { label: "GMB - Mohammadwadi", header: "[GBP-MOHAMMADWADI]" };
  const g = /^SRC-GOOGLE-G([1-7])$/.exec(t);
  if (g) return { label: `Google Ads (G${g[1]})`, header: `[GOOGLE-ADS-G${g[1]}]` };
  if (t === "SRC-GOOGLE-ADS") return { label: "Google Ads", header: "[GOOGLE-ADS]" };
  const m = /^SRC-META-M([1-7])$/.exec(t);
  if (m) return { label: `Meta Ads (M${m[1]})`, header: `[META-ADS-M${m[1]}]` };
  if (t === "SRC-META-ADS") return { label: "Meta Ads", header: "[META-ADS]" };
  if (t === "SRC-ORGANIC-SEO") {
    const slug = landingPage && slugFromPath(landingPage) !== "WEB" ? titleCase(slugFromPath(landingPage)) : null;
    return { label: slug ? `SEO Landing Page (${slug})` : "SEO Landing Page", header: "[SEO-WEB]" };
  }
  if (t === "SRC-DIRECT-WA" || t === "SRC-RETURN-CLIENT" || t === "SRC-WEBSITE") return DIRECT_LABEL;
  const name = t.replace(/^SRC-/, "");
  return { label: isSourceTag(t) ? SOURCE_TAG_LABEL[t] : name, header: `[${name}]` };
}

/** Admin WhatsApp alert text: header on line 1, the alert, then the dedicated Source line. */
export function withSourceHeader(text: string, src: SourceLabel, landingPage?: string | null): string {
  // Owner 2026-11-13: the exact service / landing page rides on the alert so the team sees which page (campaign / keyword) produced the lead.
  const page = (landingPage ?? "").split(/[?#]/)[0]!.trim().slice(0, 120);
  return `${src.header}\n${text}\n🏷️ Source: ${src.label}${page && page !== "/" ? `\n📄 Page: ${page}` : ""}`;
}

/** The tag to store for a WhatsApp conversation start: an issued "[Ref: …]" code wins; otherwise null (caller decides Direct). */
export function sourceTagFromWhatsAppText(text: string | null | undefined): string | null {
  return sourceTagForRef(parseRefCode(text));
}

const WA_HOSTS = new Set(["wa.me", "api.whatsapp.com", "web.whatsapp.com"]);

/**
 * The same WhatsApp chat link with "[Ref: CODE]" added on its own line at the end of the pre-filled text. Returns null when the
 * link is not a customer chat link (group invites, plain wa.me/message links, other sites) or already carries a Ref.
 */
export function appendRefToWhatsAppUrl(href: string, code: string): string | null {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  if (!WA_HOSTS.has(u.hostname.toLowerCase())) return null;
  const isChat = u.hostname.toLowerCase() === "wa.me" ? /^\/\d{8,15}\/?$/.test(u.pathname) : u.pathname === "/send";
  if (!isChat) return null;
  const text = u.searchParams.get("text") ?? "";
  if (REF_RE.test(text)) return null;
  u.searchParams.set("text", text ? `${text}\n[Ref: ${code}]` : `[Ref: ${code}]`);
  return u.toString();
}
