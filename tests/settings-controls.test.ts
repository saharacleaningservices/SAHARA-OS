import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NAV_ITEMS, SETTINGS_PAGES, sectionOfHref } from "../src/components/layout/nav-config";
import { canAccess } from "../src/lib/constants";

test("Settings & Admin menu is exactly two entries (owner 2026-11-06, Task 6)", () => {
  assert.deepEqual(NAV_ITEMS.filter((i) => i.group === "admin").map((i) => i.label), ["Sahara WhatsApp Inbox", "Settings & Controls"]);
});
test("every admin page that left the menu is on the Settings & Controls hub, with its old section", () => {
  for (const href of ["/settings", "/admin/users", "/settings/pricing", "/admin/lifecycle-reminders", "/admin/whatsapp-log", "/admin/announcements", "/assistant", "/admin/trash", "/admin/audit-log", "/admin/device-approvals", "/admin/security-approvals"]) {
    assert.ok(SETTINGS_PAGES.some((p) => p.href === href), `${href} missing from the hub`);
  }
  assert.deepEqual(SETTINGS_PAGES.filter((p) => p.tab === "system-logs").map((p) => p.href), ["/admin/audit-log", "/admin/device-approvals", "/admin/security-approvals"]);
  assert.equal(sectionOfHref("/admin/audit-log"), "audit-log");
});
test("role rules are unchanged on the hub: Accounts never sees owner-only tiles", () => {
  const acc = SETTINGS_PAGES.filter((p) => canAccess("ACCOUNTS", p.section)).map((p) => p.href);
  for (const banned of ["/admin/users", "/admin/audit-log", "/admin/device-approvals", "/admin/security-approvals"]) assert.ok(!acc.includes(banned), banned);
  assert.ok(SETTINGS_PAGES.every((p) => canAccess("ADMIN", p.section)), "Super Admin sees every tile");
});
test("security alerts go to the bell only — no WhatsApp copy", () => {
  const notify = readFileSync("src/server/notify.ts", "utf8");
  assert.match(notify, /whatsappCopyFor = \(kind: NotifKind, whatsappToAdmin\?: boolean\) => !SECURITY_KINDS\.has\(kind\)/);
  assert.ok(!/CRITICAL_KINDS\.has\(input\.kind\)\) \{/.test(notify), "no WhatsApp branch keyed on security kinds");
  const sec = readFileSync("src/server/security.ts", "utf8");
  assert.ok(!sec.includes("sendWhatsApp("), "security.ts sends no WhatsApp");
});
