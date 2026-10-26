import { BOOKING_BASE, bookingLink, socialLinks } from "@/lib/social-links";

// Responsive, inline-styled HTML email signature (owner spec 2026-10-19 — high-trust, uncluttered).
//
//   header       sender's name + role (dynamic: Altaf / Francis / Shoyab …)
//   boxed table  left: the official logo, large | right: call, email, web, map pin — every item a link (target=_blank)
//   social row   Facebook · Instagram · YouTube · LinkedIn (only when set) · Book Now — coloured icons, UTM-tagged
//   badges       ONE minimal row: Google rating · Verified Staff · No Outsourced Work
//
// No tagline / GSTIN line. Email-client rules: table layout, every style inline, no web fonts / SVG / scripts, one
// <style> media query only to stack the two columns on phones, every dynamic value HTML-escaped. LinkedIn and the
// rating badge simply do not appear until they are configured — the row closes up with no gap.

// The two public numbers, in the order shown (operations line first). Kept literal so this file stays free of server imports.
const PHONES = ["8956567130", "7083347130"] as const;

export type SignatureInput = {
  /** Sender shown in the header; omit for a company-level signature. */
  name?: string | null;
  role?: string | null;
  /** Kept for callers; the signature always shows both public numbers. */
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  linkedinUrl?: string | null;
  /** Logo size in px from Settings (width 80–400, height 20–300). Blank = 220 wide, proportional. */
  logoWidth?: number | null;
  logoHeight?: number | null;
  /** Google rating text from Settings, e.g. "4.9" — badge hidden when empty. */
  googleRating?: string | null;
  googleReviewCount?: string | null;
  /** Absolute origin for the logo image; defaults to the public booking site. */
  assetBase?: string;
};

const NAVY = "#0a2540";
const BLUE = "#0B5ED7";
const MUTED = "#5b6b7f";

export const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const digits = (s: string) => s.replace(/\D/g, "");
/** "+91 70833 47130" from any Indian number spelling. */
export function prettyPhone(raw: string): string {
  const d = digits(raw).slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : raw;
}

/** "+91 89565 67130 / 70833 47130" — the country code once, as written in the brand spec. */
export function phonesDisplay(): string {
  return PHONES.map((n, i) => (i === 0 ? prettyPhone(n) : prettyPhone(n).replace(/^\+91 /, ""))).join(" / ");
}

/** Settings address → "Opp. South Gate, Magarpatta City, Hadapsar, Pune 411028" (adds the PIN, drops a trailing full stop). */
export function signatureAddress(raw?: string | null): string {
  const base = (raw || "Opp. South Gate, Magarpatta City, Hadapsar, Pune.").replace(/[.\s]+$/, "").trim();
  if (/\b\d{6}\b/.test(base)) return base;
  return /Pune$/i.test(base) ? `${base} 411028` : `${base}, Pune 411028`;
}

const clampPx = (v: number | null | undefined, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;

/** Logo box from Settings: width default 220, height only when set; the logo column grows with the logo. */
export function logoSize(i: Pick<SignatureInput, "logoWidth" | "logoHeight">) {
  const width = clampPx(i.logoWidth, 80, 400) ?? 220;
  const height = clampPx(i.logoHeight, 20, 300);
  return { width, height, column: width + 30 };
}

export const mapsHref = (address: string) => `https://maps.google.com/?q=${encodeURIComponent(address)}`;

/** "1800+" → "1,800+"; anything that is not a plain number (with optional +) is shown as typed. */
export function formatCount(v: string): string {
  const m = /^(\d{1,9})(\+?)$/.exec(v.trim());
  return m ? `${Number(m[1]).toLocaleString("en-IN")}${m[2]}` : v.trim();
}

// Contact / trust emoji are written as numeric entities so the HTML stays pure ASCII (safe in any charset / client).
const E = { phone: "&#128222;", mail: "&#9993;&#65039;", web: "&#127760;", pin: "&#128205;", star: "&#11088;", tick: "&#10004;&#65039;", shield: "&#128737;&#65039;" };

const link = (href: string, text: string) =>
  `<a href="${esc(href)}" target="_blank" style="color:${BLUE};text-decoration:none;">${text}</a>`;

/** Coloured brand icon (PNG hosted at /brand/social, 44 px shown at 22 px) + the label as live text, so the pill still reads with images blocked. */
const pill = (href: string, iconUrl: string, label: string) =>
  `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px 5px 7px;border:1px solid #c9d7ea;border-radius:18px;background:#ffffff;color:${NAVY};font:600 12px/22px Arial,Helvetica,sans-serif;text-decoration:none;white-space:nowrap;"><img src="${esc(iconUrl)}" width="22" height="22" alt="" style="display:inline-block;width:22px;height:22px;border:0;vertical-align:middle;margin:0 6px 0 0;">${esc(label)}</a>`;

export function renderSignatureHtml(i: SignatureInput = {}): string {
  const email = i.email || "contact@saharacleaningservices.com";
  const address = signatureAddress(i.address);
  const assets = (i.assetBase || BOOKING_BASE).replace(/\/$/, "");
  const logo = `${assets}/brand/sahara-logo@2x.png`;
  const icon = (name: string) => `${assets}/brand/social/${name}.png`;
  const lg = logoSize(i);
  const bookHref = bookingLink("email_signature", "email", "booking_cta");
  const bookText = BOOKING_BASE.replace(/^https?:\/\//, "");
  const links = socialLinks("email_signature", i.linkedinUrl);
  const rating = (i.googleRating ?? "").trim();
  const reviews = (i.googleReviewCount ?? "").trim();

  const header = i.name
    ? `<div style="font-family:Arial,Helvetica,sans-serif;padding:0 0 10px 0;">
         <div style="font-size:18px;line-height:23px;font-weight:700;color:${NAVY};">${esc(i.name)}</div>
         ${i.role ? `<div style="font-size:13px;line-height:18px;color:${MUTED};">${esc(i.role)} &mdash; Sahara Cleaning Services</div>` : ""}
       </div>`
    : "";

  const row = (icon: string, value: string) =>
    `<tr><td style="padding:0 8px 7px 0;font:14px/19px Arial,Helvetica,sans-serif;vertical-align:top;width:22px;">${icon}</td><td style="padding:0 0 7px 0;font:13px/19px Arial,Helvetica,sans-serif;color:#26364a;">${value}</td></tr>`;

  const phones = PHONES.map((n, k) => link(`tel:+91${n}`, esc(k === 0 ? prettyPhone(n) : prettyPhone(n).replace(/^\+91 /, "")))).join(" / ");

  // One minimal row; each badge is its own non-breaking unit so a phone can wrap between badges, never inside one.
  const badge = (t: string) => `<span style="display:inline-block;margin:0 14px 4px 0;white-space:nowrap;font:600 12px/18px Arial,Helvetica,sans-serif;color:#26364a;">${t}</span>`;
  const badges = [
    rating ? badge(`${E.star} ${esc(rating)}/5${reviews ? ` (${esc(formatCount(reviews))} Google Reviews)` : " on Google"}`) : "",
    badge(`${E.tick} Verified Staff`),
    badge(`${E.shield} No Outsourced Work`),
  ].join("");

  return `<!--[if mso]><table role="presentation"><tr><td><![endif]-->
<style>@media only screen and (max-width:520px){.sh-col{display:block!important;width:100%!important;border-left:0!important}.sh-logo{border-bottom:1px solid #d7e3f4!important;padding:14px!important}.sh-info{padding:14px!important}}</style>
<div style="max-width:620px;margin:18px 0 0 0;border-top:3px solid ${BLUE};padding-top:12px;">
  ${header}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d7e3f4;border-radius:8px;border-collapse:separate;">
    <tr>
      <td class="sh-col sh-logo" width="${lg.column}" valign="middle" align="center" style="width:${lg.column}px;padding:16px;">
        <img src="${esc(logo)}" width="${lg.width}"${lg.height ? ` height="${lg.height}"` : ""} alt="Sahara Cleaning Services" style="display:block;width:${lg.width}px;max-width:100%;height:${lg.height ? `${lg.height}px` : "auto"};border:0;margin:0 auto;">
      </td>
      <td class="sh-col sh-info" valign="middle" style="padding:16px 14px 9px 18px;border-left:1px solid #d7e3f4;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          ${row(E.phone, phones)}
          ${row(E.mail, link(`mailto:${email}`, esc(email)))}
          ${row(E.web, link(bookHref, esc(bookText)))}
          ${row(E.pin, link(mapsHref(address), esc(address)))}
        </table>
      </td>
    </tr>
  </table>
  <div style="margin:12px 0 0 0;">${links.map((l) => pill(l.href, icon(l.key), l.label)).join("")}${pill(bookHref, icon("book"), "Book Now")}</div>
  <div style="margin:6px 0 0 0;">${badges}</div>
</div>
<!--[if mso]></td></tr></table><![endif]-->`;
}

/** Plain-text twin of the signature — every HTML email also carries this as its text part. */
export function renderSignatureText(i: SignatureInput = {}): string {
  const lines = [
    "--",
    ...(i.name ? [i.name + (i.role ? ` — ${i.role}` : ""), "Sahara Cleaning Services"] : ["Sahara Cleaning Services"]),
    `Call: ${phonesDisplay()}`,
    `Email: ${i.email || "contact@saharacleaningservices.com"}`,
    `Book online: ${bookingLink("email_signature", "email", "booking_cta")}`,
    `Visit: ${signatureAddress(i.address)}`,
    ...socialLinks("email_signature", i.linkedinUrl).map((l) => `${l.label}: ${l.href}`),
  ];
  return lines.join("\n");
}

/**
 * A complete branded email: the message paragraphs (plain text in, escaped here) followed by the signature.
 * Returns both parts so the sender keeps a text fallback.
 */
export function brandedEmail(message: string, sig: SignatureInput = {}): { html: string; text: string } {
  const paras = message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;font:14px/21px Arial,Helvetica,sans-serif;color:#1c2b3d;">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#ffffff;"><div style="max-width:660px;">${paras}${renderSignatureHtml(sig)}</div></body></html>`;
  return { html, text: `${message.trim()}\n\n${renderSignatureText(sig)}` };
}
