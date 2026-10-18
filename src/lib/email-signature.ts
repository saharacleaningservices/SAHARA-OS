import { BOOKING_BASE, bookingLink, socialLinks } from "@/lib/social-links";

// Both public numbers (lib/constants COMPANY.phones) — kept literal here so this file stays free of server imports.
const COMPANY_PHONES = ["7083347130", "8956567130"] as const;

// Responsive, inline-styled HTML email signature (owner spec 2026-10-18).
//
//   header      sender's name + role (dynamic: Altaf / Francis / Shoyab …)
//   boxed table left: official logo (sahara-logo@2x.png) | right: both phone numbers, email, booking URL, address
//   CONNECT WITH US     Facebook · Instagram · YouTube · LinkedIn (only when set) · Book Now — all UTM-tagged
//   TRUST & QUALITY     Google rating (from Settings) · Verified Staff · No Outsourced Work
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

// Contact / trust emoji are written as numeric entities so the HTML stays pure ASCII (safe in any charset / client).
const E = { phone: "&#128222;", mail: "&#9993;&#65039;", web: "&#127760;", pin: "&#128205;", star: "&#11088;", tick: "&#10004;&#65039;", shield: "&#128737;&#65039;" };

/** Coloured brand icon (PNG hosted at /brand/social, 44 px shown at 20 px) + the label as live text, so the pill still reads with images blocked. */
const pill = (href: string, iconUrl: string, label: string) =>
  `<a href="${esc(href)}" target="_blank" style="display:inline-block;margin:0 6px 6px 0;padding:5px 12px 5px 7px;border:1px solid #c9d7ea;border-radius:18px;background:#ffffff;color:${NAVY};font:600 12px/20px Arial,Helvetica,sans-serif;text-decoration:none;white-space:nowrap;"><img src="${esc(iconUrl)}" width="20" height="20" alt="" style="display:inline-block;width:20px;height:20px;border:0;vertical-align:middle;margin:0 6px 0 0;">${esc(label)}</a>`;

const tag = (text: string, border: string, bg: string, fg: string) =>
  `<span style="display:inline-block;margin:0 8px 6px 0;padding:4px 10px;border:1px solid ${border};border-radius:12px;background:${bg};font:700 12px/16px Arial,Helvetica,sans-serif;color:${fg};">${text}</span>`;

const heading = (t: string) => `<div style="margin:12px 0 6px 0;font:700 11px/14px Arial,Helvetica,sans-serif;letter-spacing:1px;color:${MUTED};">${t}</div>`;

/** "+91 70833 47130" for each distinct number, joined with " / ". */
function phoneLine(primary: string, extra: readonly string[]) {
  const seen = new Set<string>();
  const nums = [primary, ...extra].filter((n) => {
    const d = digits(n).slice(-10);
    if (d.length !== 10 || seen.has(d)) return false;
    seen.add(d);
    return true;
  });
  return nums
    .slice(0, 2)
    .map((n) => `<a href="tel:+91${digits(n).slice(-10)}" style="color:${BLUE};text-decoration:none;">${esc(prettyPhone(n))}</a>`)
    .join(" / ");
}

export function renderSignatureHtml(i: SignatureInput = {}): string {
  const email = i.email || "contact@saharacleaningservices.com";
  const rawAddress = i.address || "Opp. South Gate, Magarpatta City, Hadapsar, Pune.";
  const address = /maharashtra/i.test(rawAddress) ? rawAddress : `${rawAddress.replace(/[.\s]+$/, "")}, Maharashtra, India`;
  const assets = (i.assetBase || BOOKING_BASE).replace(/\/$/, "");
  const logo = `${assets}/brand/sahara-logo@2x.png`;
  const icon = (name: string) => `${assets}/brand/social/${name}.png`;
  const bookHref = bookingLink("email_signature", "email", "booking_cta");
  const bookText = BOOKING_BASE.replace(/^https?:\/\//, "");
  const links = socialLinks("email_signature", i.linkedinUrl);
  const rating = (i.googleRating ?? "").trim();
  const reviews = (i.googleReviewCount ?? "").trim();

  const header = i.name
    ? `<div style="font-family:Arial,Helvetica,sans-serif;padding:0 0 10px 0;">
         <div style="font-size:17px;line-height:22px;font-weight:700;color:${NAVY};">${esc(i.name)}</div>
         ${i.role ? `<div style="font-size:13px;line-height:18px;color:${MUTED};">${esc(i.role)} &mdash; Sahara Cleaning Services</div>` : ""}
       </div>`
    : "";

  const row = (icon: string, value: string) =>
    `<tr><td style="padding:0 8px 6px 0;font:14px/18px Arial,Helvetica,sans-serif;vertical-align:top;width:22px;">${icon}</td><td style="padding:0 0 6px 0;font:13px/18px Arial,Helvetica,sans-serif;color:#26364a;">${value}</td></tr>`;

  const trust = [
    rating ? tag(`${E.star} ${esc(rating)} on Google${reviews ? ` &middot; ${esc(reviews)} reviews` : ""}`, "#f1c232", "#fff8e1", "#7a5b00") : "",
    tag(`${E.tick} Verified Staff`, "#9bd3ae", "#eefaf2", "#1d6b3a"),
    tag(`${E.shield} No Outsourced Work`, "#b7c8e6", "#eef4fc", NAVY),
  ].join("");

  return `<!--[if mso]><table role="presentation"><tr><td><![endif]-->
<style>@media only screen and (max-width:480px){.sh-col{display:block!important;width:100%!important;border-left:0!important}.sh-logo{border-bottom:1px solid #d7e3f4!important;padding:12px!important}.sh-info{padding:12px!important}}</style>
<div style="max-width:560px;margin:18px 0 0 0;border-top:3px solid ${BLUE};padding-top:12px;">
  ${header}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d7e3f4;border-radius:8px;border-collapse:separate;">
    <tr>
      <td class="sh-col sh-logo" width="170" valign="middle" align="center" style="width:170px;padding:14px;">
        <a href="${esc(bookHref)}" target="_blank"><img src="${esc(logo)}" width="150" alt="Sahara Cleaning Services" style="display:block;width:150px;max-width:100%;height:auto;border:0;"></a>
      </td>
      <td class="sh-col sh-info" valign="middle" style="padding:14px 14px 8px 16px;border-left:1px solid #d7e3f4;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          ${row(E.phone, phoneLine(i.phone || COMPANY_PHONES[0], COMPANY_PHONES))}
          ${row(E.mail, `<a href="mailto:${esc(email)}" style="color:${BLUE};text-decoration:none;">${esc(email)}</a>`)}
          ${row(E.web, `<a href="${esc(bookHref)}" target="_blank" style="color:${BLUE};text-decoration:none;">${esc(bookText)}</a>`)}
          ${row(E.pin, esc(address))}
        </table>
      </td>
    </tr>
  </table>
  ${heading("CONNECT WITH US:")}
  <div style="margin:0;">${links.map((l) => pill(l.href, icon(l.key), l.label)).join("")}${pill(bookHref, icon("book"), "Book Now")}</div>
  ${heading("TRUST &amp; QUALITY ASSURANCE:")}
  <div style="margin:0;">${trust}</div>
</div>
<!--[if mso]></td></tr></table><![endif]-->`;
}

/** Plain-text twin of the signature — every HTML email also carries this as its text part. */
export function renderSignatureText(i: SignatureInput = {}): string {
  const lines = [
    "--",
    ...(i.name ? [i.name + (i.role ? ` — ${i.role}` : ""), "Sahara Cleaning Services"] : ["Sahara Cleaning Services"]),
    `Call: ${[...new Set([i.phone || "7083347130", "7083347130", "8956567130"].map((n) => prettyPhone(n)))].slice(0, 2).join(" / ")}`,
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
