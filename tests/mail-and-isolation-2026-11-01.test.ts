import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MAIL_FROM, STAFF_ALIASES, adminAlertEmail, smtpSettings } from "../src/lib/mail-config";
import { KIND_ROLES } from "../src/server/notify";

test("Hostinger SMTP defaults and fixed sender", () => {
  assert.equal(smtpSettings({}), null);
  assert.equal(smtpSettings({ SMTP_USER: "contact@saharacleaningservices.com" }), null);
  const s = smtpSettings({ SMTP_USER: "contact@saharacleaningservices.com", SMTP_PASS: "x" })!;
  assert.deepEqual([s.host, s.port, s.secure], ["smtp.hostinger.com", 465, true]);
  assert.equal(MAIL_FROM, "SAHARA Cleaning Services <contact@saharacleaningservices.com>");
  assert.ok(STAFF_ALIASES.includes("shoyab@saharacleaningservices.com") && STAFF_ALIASES.includes("francis@saharacleaningservices.com"));
  assert.ok(!STAFF_ALIASES.some((a) => MAIL_FROM.includes(a)));
  const src = readFileSync("src/lib/email.ts", "utf8");
  assert.ok(!/process\.env\.EMAIL_FROM/.test(src), "sender must not come from env");
  assert.match(src, /from: MAIL_FROM/);
});

test("server-down alerts: backup address default, Super Admin only", () => {
  assert.equal(adminAlertEmail({}), "sheikhaltaf161@gmail.com");
  assert.equal(adminAlertEmail({ ADMIN_ALERT_EMAIL: "Boss@Example.com" }), "boss@example.com");
  assert.match(readFileSync("src/server/health.ts", "utf8"), /emailAdminAlert/);
  assert.match(readFileSync("src/server/backup-health.ts", "utf8"), /emailAdminAlert/);
});

test("system / hosting / security notifications are invisible to Francis, Shoyab and staff", () => {
  const SYSTEM = ["DEVICE_LOGIN", "PASSWORD_OTP", "APPROVAL_REQUEST", "LOGIN_ATTEMPT", "LOGIN_ID_RECOVERY", "BACKUP_STALE", "OPS_ESCALATION"] as const;
  for (const k of SYSTEM) assert.deepEqual(KIND_ROLES[k], ["ADMIN"], k);
  for (const role of ["ACCOUNTS", "OPERATIONS", "SUPERVISOR", "STAFF"]) for (const k of SYSTEM) assert.ok(!KIND_ROLES[k].includes(role as never), `${role} sees ${k}`);
  const health = readFileSync("src/app/api/health/route.ts", "utf8");
  assert.match(health, /getSession/); // full report only for the Super Admin session or token
});
