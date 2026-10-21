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
