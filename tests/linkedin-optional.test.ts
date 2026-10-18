// LinkedIn is optional (owner 2026-10-18): omitted → no icon, no gap, nothing broken; set → icon with utm_source.
// Run: npm run test:linkedin
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { companySettingsSchema } from "../src/lib/validation";
import { renderSignatureHtml } from "../src/lib/email-signature";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-li-"));
const dbFile = path.join(dir, "t.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let FooterSocial: typeof import("../src/components/public/footer-social").FooterSocial;
test.before(async () => {
  // tsx compiles .tsx with the classic JSX runtime; Next uses the automatic one. Provide React for the test only.
  (globalThis as unknown as { React: unknown }).React = await import("react");
  db = (await import("../src/lib/db")).db;
  FooterSocial = (await import("../src/components/public/footer-social")).FooterSocial;
});
test.after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const footer = async () => renderToStaticMarkup(await FooterSocial({}));
const labels = (html: string) => [...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]);

test("Settings: LinkedIn field is optional — blank is fine, junk is rejected, a real https linkedin.com link is accepted", () => {
  const base = { name: "Sahara", phone: "7083347130", email: "contact@saharacleaningservices.com", address: "Magarpatta City, Pune" };
  assert.ok(companySettingsSchema.safeParse(base).success, "field omitted entirely");
  assert.ok(companySettingsSchema.safeParse({ ...base, linkedinUrl: "" }).success, "blank");
  assert.ok(companySettingsSchema.safeParse({ ...base, linkedinUrl: "https://www.linkedin.com/company/sahara-cleaning" }).success);
  for (const bad of ["linkedin.com/company/x", "http://www.linkedin.com/company/x", "https://evil.example/linkedin.com/x", "javascript:alert(1)", "https://notlinkedin.com/x"]) {
    assert.equal(companySettingsSchema.safeParse({ ...base, linkedinUrl: bad }).success, false, bad);
  }
});

test("footer without LinkedIn: exactly Facebook, Instagram, YouTube — no empty slot, no broken link", async () => {
  await db.companySettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: { linkedinUrl: null } });
  const html = await footer();
  assert.deepEqual(labels(html), ["Facebook", "Instagram", "YouTube"]);
  assert.ok(!/linkedin/i.test(html.replace(/utm_[a-z]+=[^"&]*/g, "")), "no LinkedIn anywhere");
  assert.ok(!html.includes('href=""') && !html.includes("undefined") && !html.includes("null"));
});

test("footer with LinkedIn: the icon appears, tagged utm_source=footer; a stored invalid value is ignored", async () => {
  await db.companySettings.update({ where: { id: "default" }, data: { linkedinUrl: "https://www.linkedin.com/company/sahara-cleaning" } });
  const html = (await footer()).replace(/&amp;/g, "&");
  assert.deepEqual(labels(html), ["Facebook", "Instagram", "YouTube", "LinkedIn"]);
  assert.match(html, /href="https:\/\/www\.linkedin\.com\/company\/sahara-cleaning\?utm_source=footer&utm_medium=social&utm_campaign=linkedin_profile"/);
  await db.companySettings.update({ where: { id: "default" }, data: { linkedinUrl: "http://phish.example/x" } });
  assert.deepEqual(labels(await footer()), ["Facebook", "Instagram", "YouTube"], "invalid stored value never renders");
});

test("email signature without LinkedIn: no LinkedIn pill and the remaining pills still render", () => {
  const h = renderSignatureHtml({ name: "Altaf Shaikh", role: "Super Admin" });
  assert.ok(!h.includes("LinkedIn"));
  for (const n of ["Facebook", "Instagram", "YouTube", "Book Now"]) assert.ok(h.includes(`>${n}</a>`), n);
  assert.ok(renderSignatureHtml({ linkedinUrl: "https://www.linkedin.com/in/x" }).includes(">LinkedIn</a>"));
});
