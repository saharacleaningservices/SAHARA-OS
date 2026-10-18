import { BOOKING_BASE, bookingLink, socialLinks } from "@/lib/social-links";

// Responsive, inline-styled HTML email signature (owner spec 2026-10-18).
//
//   header      sender's name + role (dynamic: Altaf / Francis / Shoyab …)
//   left        official logo artwork (sahara-logo@2x.png)
//   divider →   phone, email, booking URL, address
//   social bar  Facebook · Instagram · YouTube · LinkedIn (only when set) · Book Now — all UTM-tagged
//   trust       Google rating badge (from Settings) + Verified Staff
//
// Email-client rules followed: table layout, every style inline, no web fonts / SVG / scripts, no external icon
// images (nothing breaks with images blocked), one <style> media query only to stack the two columns on phones,
// every dynamic value HTML-escaped. LinkedIn and the rating badge simply do not appear until they are configured.

export type SignatureInput = {
  /** Sender shown in the header; omit for a company-level signature. */
  name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  linkedinUrl?: string | null;
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

const pill = (href: string, label: string, bg: string, fg = "#ffffff") =>
  `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 6px 6px 0;padding:6px 11px;border-radius:14px;background:${bg};color:${fg};font:600 12px/16px Arial,Helvetica,sans-serif;text-decoration:none;">${esc(label)}</a>`;

const BRAND_BG: Record<string, string> = { facebook: "#1877F2", instagram: "#C13584", youtube: "#E02424", linkedin: "#0A66C2" };

export function renderSignatureHtml(i: SignatureInput = {}): string {
  const phone = prettyPhone(i.phone || "7083347130");
  const email = i.email || "contact@saharacleaningservices.com";
  const address = i.address || "Opp. South Gate, Magarpatta City, Hadapsar, Pune.";
  const logo = `${(i.assetBase || BOOKING_BASE).replace(/\/$/, "")}/brand/sahara-logo@2x.png`;
  const bookHref = bookingLink("email_signature", "email", "booking_cta");
  const bookText = BOOKING_BASE.replace(/^https?:\/\//, "");
  const links = socialLinks("email_signature", i.linkedinUrl);
  const rating = (i.googleRating ?? "").trim();
  const reviews = (i.googleReviewCount ?? "").trim();

  const header = i.name
    ? `<tr><td colspan="2" style="padding:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;">
         <div style="font-size:16px;line-height:20px;font-weight:700;color:${NAVY};">${esc(i.name)}</div>
         ${i.role ? `<div style="font-size:12px;line-height:16px;color:${MUTED};">${esc(i.role)} &middot; Sahara Cleaning Services</div>` : ""}
       </td></tr>`
    : "";

  const row = (label: string, value: string) =>
    `<tr><td style="padding:0 8px 4px 0;font:700 12px/17px Arial,Helvetica,sans-serif;color:${NAVY};white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:0 0 4px 0;font:12px/17px Arial,Helvetica,sans-serif;color:#26364a;">${value}</td></tr>`;

  const trust = [
    rating ? `<span style="display:inline-block;margin:0 8px 4px 0;padding:4px 9px;border:1px solid #f1c232;border-radius:12px;background:#fff8e1;font:700 12px/16px Arial,Helvetica,sans-serif;color:#7a5b00;">&#9733; ${esc(rating)} on Google${reviews ? ` &middot; ${esc(reviews)} reviews` : ""}</span>` : "",
    `<span style="display:inline-block;margin:0 8px 4px 0;padding:4px 9px;border:1px solid #9bd3ae;border-radius:12px;background:#eefaf2;font:700 12px/16px Arial,Helvetica,sans-serif;color:#1d6b3a;">&#10004; Verified Staff</span>`,
  ].join("");

  return `<!--[if mso]><table role="presentation"><tr><td><![endif]-->
<style>@media only screen and (max-width:480px){.sh-col{display:block!important;width:100%!important;border-left:0!important;padding-left:0!important}.sh-logo{padding-bottom:10px!important}}</style>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:16px 0 0 0;border-top:2px solid ${BLUE};">
  <tr><td style="padding-top:12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      ${header}
      <tr>
        <td class="sh-col sh-logo" width="160" valign="middle" style="width:160px;padding:0 16px 0 0;">
          <a href="${esc(bookHref)}" target="_blank"><img src="${esc(logo)}" width="150" alt="Sahara Cleaning Services" style="display:block;width:150px;max-width:100%;height:auto;border:0;"></a>
        </td>
        <td class="sh-col" valign="top" style="padding:0 0 0 16px;border-left:2px solid #d7e3f4;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            ${row("Call", `<a href="tel:+91${digits(phone).slice(-10)}" style="color:${BLUE};text-decoration:none;">${esc(phone)}</a>`)}
            ${row("Email", `<a href="mailto:${esc(email)}" style="color:${BLUE};text-decoration:none;">${esc(email)}</a>`)}
            ${row("Book", `<a href="${esc(bookHref)}" target="_blank" style="color:${BLUE};text-decoration:none;">${esc(bookText)}</a>`)}
            ${row("Visit", esc(address))}
          </table>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:10px 0 0 0;">
        ${links.map((l) => pill(l.href, l.label, BRAND_BG[l.key] ?? NAVY)).join("")}${pill(bookHref, "Book Now", NAVY)}
      </td></tr>
      <tr><td colspan="2" style="padding:6px 0 0 0;">${trust}</td></tr>
    </table>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->`;
}

/** Plain-text twin of the signature — every HTML email also carries this as its text part. */
export function renderSignatureText(i: SignatureInput = {}): string {
  const lines = [
    "--",
    ...(i.name ? [i.name + (i.role ? ` — ${i.role}` : ""), "Sahara Cleaning Services"] : ["Sahara Cleaning Services"]),
    `Call: ${prettyPhone(i.phone || "7083347130")}`,
    `Email: ${i.email || "contact@saharacleaningservices.com"}`,
    `Book online: ${bookingLink("email_signature", "email", "booking_cta")}`,
    `Visit: ${i.address || "Opp. South Gate, Magarpatta City, Hadapsar, Pune."}`,
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
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#ffffff;"><div style="max-width:600px;">${paras}${renderSignatureHtml(sig)}</div></body></html>`;
  return { html, text: `${message.trim()}\n\n${renderSignatureText(sig)}` };
}
