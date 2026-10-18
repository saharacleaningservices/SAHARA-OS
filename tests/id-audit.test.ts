// Read-only ID audit script: finds gaps / odd formats / broken links and never changes the database. Run: npm run test:idaudit
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const dir = mkdtempSync(path.join(tmpdir(), "sahara-audit-"));
const dbFile = path.join(dir, "t.db");
const env = { ...process.env, DATABASE_URL: `file:${dbFile}` };
test.after(() => rmSync(dir, { recursive: true, force: true }));

test("audit reports gaps, Trash rows, odd formats and broken links — and leaves the database byte-for-byte unchanged", () => {
  execFileSync("node", ["scripts/db-setup.mjs"], { env, stdio: "ignore" });
  const d = new Database(dbFile);
  const now = new Date().toISOString();
  const lead = d.prepare(`INSERT INTO "Lead" ("id","leadNumber","name","mobile","area","service","source","stage","createdAt","updatedAt","deletedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  // LD numbers 1,2,3,6,7,10 → gaps 4-5 and 8-9; number 7 is in Trash.
  for (const [n, del] of [[1, null], [2, null], [3, null], [6, null], [7, now], [10, null]] as const) {
    lead.run(`l${n}`, `LD-2026-${String(n).padStart(4, "0")}`, `L${n}`, `90000000${String(n).padStart(2, "0")}`, "x", "HOME_DEEP_CLEANING", "WEBSITE", "NEW", now, now, del);
  }
  lead.run("odd", "WEIRD-1", "Odd", "9000000099", "x", "HOME_DEEP_CLEANING", "WEBSITE", "NEW", now, now, null);
  d.exec(`PRAGMA foreign_keys = OFF`);
  d.prepare(`INSERT INTO "Quotation" ("id","quoteNumber","leadId","services","subTotal","totalAmount","terms","createdAt","updatedAt") VALUES ('q1','QT-2026-0001','ghost-lead','[]',1,1,'',?,?)`).run(now, now);
  d.close();
  const before = createHash("sha256").update(readFileSync(dbFile)).digest("hex");

  const out = JSON.parse(execFileSync("node", ["scripts/audit-ids.mjs", "--json"], { env, encoding: "utf8" }));
  const lead26 = out.sequences.find((s: { label: string }) => s.label === "Lead").years.find((y: { year: string }) => y.year === "2026");
  assert.equal(lead26.count, 6);
  assert.equal(lead26.gaps, "4-5, 8-9");
  assert.equal(lead26.gapCount, 4);
  assert.equal(lead26.softDeleted, 1);
  assert.deepEqual(out.sequences.find((s: { label: string }) => s.label === "Lead").odd, ["WEIRD-1"]);
  assert.equal(out.links.quotationsWithMissingLead, 1);
  assert.equal(out.links.customersWithoutNumber, 0);

  const after = createHash("sha256").update(readFileSync(dbFile)).digest("hex");
  assert.equal(after, before, "audit must not modify the database");
  const text = execFileSync("node", ["scripts/audit-ids.mjs"], { env, encoding: "utf8" });
  assert.match(text, /Nothing was changed/);
});

test("the script opens the file read-only (cannot write even by mistake)", () => {
  const src = readFileSync("scripts/audit-ids.mjs", "utf8");
  assert.ok(src.includes("readonly: true") && src.includes("fileMustExist: true"));
  assert.ok(!/\b(UPDATE|DELETE FROM|INSERT INTO|DROP|ALTER)\b/.test(src.replace(/\/\/.*$/gm, "").replace(/`[^`]*SELECT[^`]*`/g, "")), "no write statements");
});
