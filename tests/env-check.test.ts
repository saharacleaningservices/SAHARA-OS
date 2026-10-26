import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error plain .mjs module
import { checkEnv } from "../scripts/env-check.mjs";

const good = { NODE_ENV: "production", AUTH_SECRET: "x".repeat(40), DATABASE_URL: "file:/data/dev.db" };

test("a healthy production environment has no errors", () => {
  const r = checkEnv(good);
  assert.deepEqual(r.errors, []);
});

test("missing AUTH_SECRET or a non-file DATABASE_URL stop the boot in production", () => {
  assert.equal(checkEnv({ ...good, AUTH_SECRET: "" }).errors.length, 1);
  assert.equal(checkEnv({ ...good, DATABASE_URL: "postgres://x" }).errors.length, 1);
  assert.deepEqual(checkEnv({ ...good, DATABASE_URL: "" }).errors, [], "an unset DATABASE_URL only warns — it must never block an existing deploy");
});

test("a short secret or half-configured integration only warns — it never blocks a deploy", () => {
  const r = checkEnv({ ...good, AUTH_SECRET: "short-secret-12345", WHATSAPP_ACCESS_TOKEN: "t" });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w: string) => /AUTH_SECRET/.test(w)));
  assert.ok(r.warnings.some((w: string) => /WhatsApp Cloud API/.test(w)));
});

test("development is never blocked and values are never echoed", () => {
  assert.deepEqual(checkEnv({ NODE_ENV: "development" }).errors, []);
  const r = checkEnv({ ...good, AUTH_SECRET: "abc" });
  assert.ok(!JSON.stringify(r).includes("abc\""));
});

test("WhatsApp readiness: plain warnings for what still blocks customers or the chatbot; nothing when fully configured; never an error", () => {
  const wa = { ...good, WHATSAPP_ACCESS_TOKEN: "t".repeat(20), WHATSAPP_PHONE_NUMBER_ID: "123456789" };
  const bare = checkEnv(wa);
  assert.deepEqual(bare.errors, []);
  for (const re of [/WHATSAPP_OUTBOUND_MODE/, /WEBHOOK_VERIFY_TOKEN/, /WHATSAPP_APP_SECRET/, /WHATSAPP_USE_TEMPLATES/, /WHATSAPP_AUTO_REPLIES/]) assert.ok(bare.warnings.some((w: string) => re.test(w)), String(re));
  assert.ok(checkEnv({ ...wa, WHATSAPP_OUTBOUND_MODE: "test" }).warnings.some((w: string) => /real customers receive nothing/.test(w)));
  const ready = checkEnv({ ...wa, WHATSAPP_OUTBOUND_MODE: "transactional", WHATSAPP_WEBHOOK_VERIFY_TOKEN: "v".repeat(20), WHATSAPP_APP_SECRET: "s".repeat(20), WHATSAPP_USE_TEMPLATES: "on", WHATSAPP_COMPLETED_TEMPLATE: "v3", WHATSAPP_AUTO_REPLIES: "on", WHATSAPP_BUSINESS_ACCOUNT_ID: "1" });
  assert.deepEqual(ready.warnings.filter((w: string) => /^WhatsApp:/.test(w)), []);
  assert.ok(!JSON.stringify(bare).includes("t".repeat(20)), "values are never echoed");
  assert.ok(checkEnv({ ...good, CALL_AUTOREPLY: "on" }).warnings.some((w: string) => /CALL_TRIGGER_TOKEN/.test(w)));
});
