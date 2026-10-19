// HTML email signature, LinkedIn UTM links and the HTML-capable email pipeline. Run: npm run test:signature
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { brandedEmail, esc, formatCount, mapsHref, phonesDisplay, prettyPhone, renderSignatureHtml, renderSignatureText, signatureAddress } from "../src/lib/email-signature";
import { socialLinks, socialProfileUrls } from "../src/lib/social-links";

const LI = "https://www.linkedin.com/company/sahara-cleaning-services";
const FULL = { name: "Shoyab Kazi", role: "Accounts & Operations Editor", googleRating: "4.9", googleReviewCount: "1800+", linkedinUrl: LI };
const NON_ASCII = new RegExp("[^\\x00-\\x7F]");

/** [href, inner html] of every <a> in the signature. */
const anchors = (h: string) => [...h.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ attrs: m[1], href: (/href="([^"]+)"/.exec(m[1]) ?? [])[1]?.replace(/&amp;/g, "&") ?? "", inner: m[2] }));

test("signature carries every item of the redesigned layout", () => {
  const h = renderSignatureHtml(FULL);
  assert.ok(h.includes("Shoyab Kazi") && h.includes("Accounts &amp; Operations Editor &mdash; Sahara Cleaning Services"), "header: name + role");
  assert.ok(h.includes("/brand/sahara-logo@2x.png") && /src="https?:\/\//.test(h), "absolute logo URL");
  assert.ok(h.includes("+91 89565 67130</a> / <a") && h.includes(">70833 47130</a>"), "both numbers, operations line first, country code once");
  assert.ok(h.includes("contact@saharacleaningservices.com") && h.includes("booking.saharacleaningservices.com"));
  assert.ok(h.includes("Opp. South Gate, Magarpatta City, Hadapsar, Pune 411028"), "address with PIN");
  for (const e of ["&#128222;", "&#9993;", "&#127760;", "&#128205;"]) assert.ok(h.includes(e), `contact icon ${e}`);
  for (const f of ["facebook", "instagram", "youtube", "linkedin", "book"]) assert.ok(existsSync(`public/brand/social/${f}.png`), `${f}.png is shipped`);
  assert.ok(!NON_ASCII.test(h), "pure ASCII — safe in any charset, entities for symbols");
});

test("every item is a link opening in a new tab: call, email, web, map pin, each brand icon, Book Now", () => {
  const a = anchors(renderSignatureHtml(FULL));
  for (const x of a) assert.match(x.attrs, /target="_blank"/, `${x.href} opens in a new tab`);
  const hrefs = a.map((x) => x.href);
  assert.ok(hrefs.includes("tel:+918956567130") && hrefs.includes("tel:+917083347130"), "phone links");
  assert.ok(hrefs.includes("mailto:contact@saharacleaningservices.com"), "email link");
  const web = a.find((x) => x.inner.includes("booking.saharacleaningservices.com"))!;
  assert.match(web.href, /^https:\/\/booking\.saharacleaningservices\.com\/booking\?utm_source=email_signature/);
  const pin = a.find((x) => x.inner.includes("411028"))!;
  assert.match(pin.href, /^https:\/\/maps\.google\.com\/\?q=Opp\.%20South%20Gate/);
  for (const [icon, n] of [["facebook", "Facebook"], ["instagram", "Instagram"], ["youtube", "YouTube"], ["linkedin", "LinkedIn"], ["book", "Book Now"]]) {
    const x = a.find((y) => y.inner.includes(`/brand/social/${icon}.png`));
    assert.ok(x && x.inner.endsWith(n), `${n}: coloured brand icon + text label, inside the link`);
  }
});

test("the logo is large and crisp: 220 px wide from the 830 px artwork, on a 250 px column", () => {
  const h = renderSignatureHtml(FULL);
  assert.ok(/<img src="[^"]*sahara-logo@2x\.png" width="220"/.test(h) && h.includes("width:220px"));
  assert.ok(h.includes('width="250"') && h.includes("width:250px"), "logo column wide enough for it");
  assert.ok(h.includes("max-width:100%"), "never overflows a narrow screen");
});

test("trust badges are ONE minimal row: rating (with formatted review count), Verified Staff, No Outsourced Work — no headings, no tagline", () => {
  const h = renderSignatureHtml(FULL);
  assert.ok(h.includes("&#11088; 4.9/5 (1,800+ Google Reviews)"), "rating + 1,800+ reviews");
  assert.ok(h.includes("&#10004;&#65039; Verified Staff") && h.includes("&#128737;&#65039; No Outsourced Work"));
  const row = h.slice(h.indexOf("&#11088;") - 260, h.indexOf("No Outsourced Work") + 40);
  assert.equal((row.match(/<div/g) ?? []).length, 1, "all three badges sit inside a single container");
  assert.ok(!/CONNECT WITH US|TRUST &amp; QUALITY/.test(h), "section headings removed");
  assert.ok(!/Serving Pune since|In-house Verified Staff|GSTIN|27DMTPS3584R2ZJ/i.test(h), "bottom tagline / GSTIN line removed");
  assert.ok(!/Serving Pune|GSTIN/i.test(renderSignatureText(FULL)), "and from the plain-text twin");
});

test("LinkedIn is optional: blank → no LinkedIn pill and no gap; the rating badge needs a value; the fixed badges stay", () => {
  const bare = renderSignatureHtml({ name: "Altaf Shaikh", role: "Super Admin" });
  assert.ok(!bare.includes("LinkedIn") && !bare.includes("linkedin"), "no invented LinkedIn");
  assert.ok(!bare.includes("Google Reviews") && !bare.includes("/5"), "no rating without a value");
  assert.ok(bare.includes("Verified Staff") && bare.includes("No Outsourced Work"));
  for (const n of ["Facebook", "Instagram", "YouTube", "Book Now"]) assert.ok(bare.includes(n), n);
  assert.ok(!bare.includes("margin:0 6px 6px 0;padding:5px 12px 5px 7px;border:1px solid #c9d7ea;border-radius:18px;background:#ffffff;color:#0a2540;font:600 12px/22px Arial,Helvetica,sans-serif;text-decoration:none;white-space:nowrap;\"><img src=\"\""), "no empty icon");
  const noReviews = renderSignatureHtml({ googleRating: "4.9" });
  assert.ok(noReviews.includes("4.9/5 on Google") && !noReviews.includes("Google Reviews)"));
  assert.ok(renderSignatureHtml({ linkedinUrl: LI }).includes(">LinkedIn</a>"));
});

test("every social link and Book Now carry utm_source=email_signature", () => {
  const hrefs = anchors(renderSignatureHtml(FULL)).map((x) => x.href).filter((h) => /facebook|instagram|youtube|linkedin|booking/.test(h));
  assert.ok(hrefs.length >= 6);
  for (const h of hrefs) {
    const u = new URL(h);
    assert.equal(u.searchParams.get("utm_source"), "email_signature", h);
    assert.ok(u.searchParams.get("utm_medium") && u.searchParams.get("utm_campaign"), h);
  }
  assert.ok(hrefs.some((h) => h.startsWith(LI) && h.includes("utm_campaign=linkedin_profile")));
});

test("helpers: address gets its PIN, review counts get a comma, phones read '+91 … / …'", () => {
  assert.equal(signatureAddress("Opp. South Gate, Magarpatta City, Hadapsar, Pune."), "Opp. South Gate, Magarpatta City, Hadapsar, Pune 411028");
  assert.equal(signatureAddress("Opp. South Gate, Magarpatta City, Hadapsar, Pune 411028"), "Opp. South Gate, Magarpatta City, Hadapsar, Pune 411028");
  assert.equal(signatureAddress("Magarpatta City, Hadapsar"), "Magarpatta City, Hadapsar, Pune 411028");
  assert.equal(signatureAddress(null), "Opp. South Gate, Magarpatta City, Hadapsar, Pune 411028");
  assert.equal(formatCount("1800+"), "1,800+");
  assert.equal(formatCount("250"), "250");
  assert.equal(formatCount("about 2k"), "about 2k");
  assert.equal(phonesDisplay(), "+91 89565 67130 / 70833 47130");
  assert.equal(mapsHref("A B, Pune"), "https://maps.google.com/?q=A%20B%2C%20Pune");
  assert.equal(prettyPhone("09370123456").startsWith("+91 "), true);
});

test("email-client safe: inline styles, table layout, stacks on phones, no script / svg / external css", () => {
  const h = renderSignatureHtml({ name: "Francis", role: "Operations Manager" });
  assert.ok(h.includes('role="presentation"') && h.includes("<table"));
  assert.ok(h.includes("@media only screen and (max-width:520px)") && h.includes(".sh-col{display:block!important"));
  assert.ok(!/<script|<svg|<link|<iframe|javascript:/i.test(h));
  for (const tag of h.match(/<(a|td|table|span|div)\b[^>]*>/g) ?? []) assert.ok(/style=|class=|href=|width=|role=|colspan=|valign=|cellpadding=/.test(tag) || tag === "<td>", `un-styled tag ${tag}`);
});

test("everything dynamic is HTML-escaped (a user name cannot inject markup)", () => {
  const h = renderSignatureHtml({ name: `<img src=x onerror=alert(1)>`, role: `Admin" onmouseover="x`, address: "A & B <b>" });
  assert.ok(!h.includes("<img src=x") && !h.includes('onmouseover="x'));
  assert.ok(h.includes("&lt;img src=x onerror=alert(1)&gt;") && h.includes("A &amp; B &lt;b&gt;"));
  assert.equal(esc(`'"<>&`), "&#39;&quot;&lt;&gt;&amp;");
  const { html } = brandedEmail("Hi <script>alert(1)</script>", {});
  assert.ok(!html.includes("<script>alert"));
});

test("branded email = escaped message paragraphs + signature, with a plain-text twin", () => {
  const m = brandedEmail("Your quotation is ready.\n\nPay 20% to confirm.", { name: "Shoyab Kazi", role: "Accounts" });
  assert.ok(m.html.startsWith("<!doctype html>") && m.html.includes('<meta charset="utf-8">') && m.html.includes("viewport") && m.html.includes("Pay 20% to confirm.") && m.html.includes("Shoyab Kazi"));
  assert.ok(m.text.startsWith("Your quotation is ready.") && m.text.includes("Book online: ") && m.text.includes("utm_source=email_signature"));
  assert.ok(renderSignatureText({}).includes("Call: +91 89565 67130 / 70833 47130") && renderSignatureText({}).includes("Pune 411028"));
});

test("footer links use utm_source=footer; only real https linkedin.com URLs are accepted; sameAs stays untagged", () => {
  const f = socialLinks("footer", LI);
  assert.deepEqual(f.map((l) => l.key), ["facebook", "instagram", "youtube", "linkedin"]);
  for (const l of f) assert.equal(new URL(l.href).searchParams.get("utm_source"), "footer");
  assert.equal(socialLinks("footer", "https://evil.example/linkedin.com/x").some((l) => l.key === "linkedin"), false);
  assert.equal(socialLinks("footer", "http://www.linkedin.com/company/x").some((l) => l.key === "linkedin"), false, "https only");
  assert.equal(socialLinks("footer", null).length, 3);
  for (const u of socialProfileUrls(LI)) assert.ok(!u.includes("utm_"), u);
});

test("pipeline: html is stored + sent when given; OTP / recovery mails stay plain; column added idempotently", () => {
  const email = readFileSync("src/lib/email.ts", "utf8");
  assert.ok(email.includes("bodyHtml: input.html ?? null") && email.includes("...(html ? { html } : {})") && email.includes("m.bodyHtml"));
  const sec = readFileSync("src/server/security.ts", "utf8");
  assert.ok(!/html:|brandedEmail/.test(sec), "security mail unchanged");
  assert.match(readFileSync("prisma/schema.prisma", "utf8"), /model EmailMessage \{[\s\S]*?bodyHtml\s+String\?/);
  assert.ok(readFileSync("scripts/db-setup.mjs", "utf8").includes(`addColumnIfMissing("EmailMessage", "bodyHtml"`));
  assert.match(readFileSync("prisma/schema.prisma", "utf8"), /model CompanySettings \{[\s\S]*?linkedinUrl\s+String\?/);
});

test("logo is not a hyperlink and its size follows the Settings values", () => {
  const h = renderSignatureHtml(FULL);
  const logoTag = /<img src="[^"]*sahara-logo@2x\.png"[^>]*>/.exec(h)![0];
  assert.ok(!anchors(h).some((a) => a.inner.includes("sahara-logo")), "logo must not sit inside an <a>");
  assert.ok(!/<a\b[^>]*>\s*<img src="[^"]*sahara-logo/.test(h));
  assert.ok(logoTag.includes('width="220"') && !logoTag.includes("height=") && logoTag.includes("height:auto"), "default 220 wide, proportional");

  const big = renderSignatureHtml({ ...FULL, logoWidth: 300, logoHeight: 120 });
  assert.ok(big.includes('width="300" height="120"') && big.includes("width:300px;max-width:100%;height:120px") && big.includes('width="330"'), "custom size + wider column");
  const clamped = renderSignatureHtml({ ...FULL, logoWidth: 9999, logoHeight: 1 });
  assert.ok(clamped.includes('width="400" height="20"'), "values clamped to 400 / 20");
  assert.ok(renderSignatureHtml({ ...FULL, logoWidth: null, logoHeight: null }).includes('width="220"'));
});
