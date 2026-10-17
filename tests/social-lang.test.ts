// Sidebar order, CRM language packs and UTM-tagged social / booking links. Run: npm run test:sociallang
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAV_GROUPS, NAV_ITEMS } from "../src/components/layout/nav-config";
import { crmTranslations } from "../src/lib/crm-i18n";
import { bookingLink, emailSignature, socialLinks, withUtm } from "../src/lib/social-links";

test("sidebar group order is fixed: Dashboards, Operations, Sales & Finance, Tools & AI, Settings & Admin", () => {
  assert.deepEqual(NAV_GROUPS.map((g) => g.label), ["Dashboards & Reports", "Operations", "Sales & Finance", "Tools & AI", "Settings & Admin"]);
});

test("Hindi and Marathi cover every sidebar group + item label and the header strings", () => {
  const need = [...NAV_GROUPS.map((g) => g.label), ...NAV_ITEMS.map((i) => i.label), "My Profile", "Settings", "Log out", "Language"];
  for (const [lang, pack] of Object.entries(crmTranslations)) {
    const missing = need.filter((t) => !pack[t]);
    assert.deepEqual(missing, [], `${lang} is missing translations`);
    for (const t of need) assert.match(pack[t], /[\u0900-\u097F]|^AI|CRM|AMC/, `${lang}: "${t}" should be Devanagari`);
  }
});

test("language switcher is in the header for all roles and the choice lives in localStorage", () => {
  const top = readFileSync("src/components/layout/topbar.tsx", "utf8");
  assert.ok(top.includes("<CrmLanguageSwitcher />") && !/role === .*CrmLanguageSwitcher/.test(top));
  const i18n = readFileSync("src/lib/crm-i18n.ts", "utf8");
  assert.ok(i18n.includes("localStorage") && i18n.includes('() => "en"'), "server snapshot is English so hydration matches");
});

test("outbound social links and the booking form carry UTM tags; no invented LinkedIn", () => {
  const links = socialLinks("site_footer");
  assert.deepEqual(links.map((l) => l.key), ["facebook", "instagram", "youtube"]);
  for (const l of links) {
    const u = new URL(l.href);
    assert.equal(u.searchParams.get("utm_source"), "sahara_site");
    assert.equal(u.searchParams.get("utm_medium"), "site_footer");
    assert.equal(u.searchParams.get("utm_campaign"), `${l.key}_profile`);
  }
  const b = new URL(bookingLink("instagram", "social", "ig_bio"));
  assert.equal(b.pathname, "/booking");
  assert.deepEqual([b.searchParams.get("utm_source"), b.searchParams.get("utm_medium"), b.searchParams.get("utm_campaign")], ["instagram", "social", "ig_bio"]);
  assert.equal(withUtm("not a url", { source: "a", medium: "b", campaign: "c" }), "not a url");
  const sig = emailSignature();
  assert.ok(sig.includes("Book online:") && sig.includes("utm_medium=email_signature") && sig.includes("YouTube:"));
});
