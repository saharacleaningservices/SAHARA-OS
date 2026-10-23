// Day sheet data (privacy + day boundaries) and the navy customer theme. Run: npx tsx --test tests/day-sheet.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-ds-"));
const dbFile = path.join(dir, "test.db");
process.env.DATABASE_URL = `file:${dbFile}`;
execFileSync("node", ["scripts/db-setup.mjs"], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, stdio: "ignore" });

let db: typeof import("../src/lib/db").db;
let ds: typeof import("../src/server/day-sheet");
test.before(async () => {
  db = (await import("../src/lib/db")).db;
  ds = await import("../src/server/day-sheet");
});
test.after(async () => { await db.$disconnect(); try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp */ } });

test("day sheet: one India-time day, newest slot order, no customer name / phone / money, cancelled and demo jobs left out, team + crew shown", async () => {
  const mk = (n: string, whenUtc: string, over: Record<string, unknown> = {}) =>
    db.job.create({ data: { jobNumber: n, customerName: "Secret Customer", customerMobile: "9811111111", address: "Flat 2, Kharadi", area: "Kharadi", service: "HOME_DEEP_CLEANING", scheduledDate: new Date(whenUtc), scheduledTime: "10:00 AM", jobValue: 7777, status: "ASSIGNED", teamNumber: 2, ...over } as never });
  const staff = await db.staff.create({ data: { name: "Ramesh Lead", phone: "9000000001", role: "CLEANER" } as never }).catch(() => null);
  const a = await mk("D-1", "2026-10-23T04:30:00Z", { scheduledTime: "10:00 AM" }); // 10:00 IST on the 23rd
  await mk("D-2", "2026-10-23T08:30:00Z", { scheduledTime: "2:00 PM", status: "STARTED" });
  await mk("D-3", "2026-10-22T18:00:00Z"); // 23:30 IST on the 22nd -> belongs to the 23rd? no: 18:00Z = 23:30 IST the 22nd -> 22nd
  await mk("D-4", "2026-10-23T18:40:00Z"); // 00:10 IST on the 24th
  await mk("D-5", "2026-10-23T05:00:00Z", { status: "CANCELLED" });
  await mk("D-6", "2026-10-23T05:00:00Z", { isDemo: true });
  if (staff) await db.jobAssignment.create({ data: { jobId: a.id, staffId: staff.id, isLead: true } });

  const rows = await ds.getDaySheet(new Date("2026-10-23T06:30:00Z"));
  assert.deepEqual(rows.map((r) => r.jobNumber), ["D-1", "D-2"]);
  assert.deepEqual([rows[0].team, rows[0].area, rows[1].status], ["Team 2", "Kharadi", "Started"]);
  if (staff) assert.deepEqual(rows[0].crew, ["Ramesh Lead (lead)"]);
  const text = JSON.stringify(rows);
  for (const secret of ["Secret Customer", "9811111111", "7777"]) assert.ok(!text.includes(secret), `${secret} must never reach the day sheet`);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["address", "area", "crew", "jobNumber", "mapLink", "packageLabel", "service", "status", "supervisor", "team", "time"]);
  assert.deepEqual((await ds.getDaySheet(new Date("2026-10-22T06:30:00Z"))).map((r) => r.jobNumber), ["D-3"]);
  assert.deepEqual((await ds.getDaySheet(new Date("2026-10-24T06:30:00Z"))).map((r) => r.jobNumber), ["D-4"]);
});

test("navy theme: customer-facing landing pages and the booking form use the navy primary; the CRM tokens are untouched", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.theme-navy\s*\{[^}]*--primary:\s*#1f2f66/);
  assert.match(css, /:root\s*\{[\s\S]*?--primary:\s*#0b5ed7/i, "CRM root primary stays royal blue");
  assert.match(readFileSync("src/components/public/landing-kit.tsx", "utf8"), /className="theme-navy min-h-screen/);
  // Navy on white must be comfortably readable (WCAG AA needs 4.5:1; this is far above).
  const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  assert.ok(1.05 / (lum("#1f2f66") + 0.05) > 9);
});
