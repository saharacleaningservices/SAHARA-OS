// Party-name clean-up, phone normalisation, source tags and Vendor Operations (owner 2026-11-04).
// Run: npx tsx --test tests/party-cleanup-vendors.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { last10, normalizePhone, toE164, validMobile10, validPhoneKey, looksTruncatedInternational } from "../src/lib/phone";
import { cleanPartyName } from "../src/lib/party-name.mjs";
import { SOURCE_TAGS, activeSourceTag, sourceTagChoices } from "../src/lib/source-tags";
import { splitCommission, clampCommission } from "../src/lib/vendor-commission";
import { CATEGORY_OPTIONS } from "../src/lib/contact-category";

test("phone: Indian numbers keep the 10-digit key and get +91; every common form agrees", () => {
  for (const raw of ["9876543210", "+91 98765 43210", "919876543210", "09876543210", "0091 9876543210", "+91-98765-43210"]) {
    assert.equal(last10(raw), "9876543210", raw);
    assert.equal(toE164(raw), "+919876543210", raw);
  }
  assert.equal(validMobile10("+91 98765 43210"), "9876543210");
});

test("phone: international numbers are never truncated to 10 digits (bug fix)", () => {
  assert.deepEqual(normalizePhone("+61401180112"), { key: "61401180112", e164: "+61401180112", international: true });
  assert.equal(last10("61401180112"), "61401180112", "WhatsApp webhook form (no +) matches the stored key");
  assert.equal(last10("+1 (650) 555-0100"), "16505550100");
  assert.equal(last10("+971 50 123 4567"), "971501234567");
  assert.equal(validMobile10("+61401180112"), null, "not an Indian mobile");
  assert.equal(validPhoneKey("+61401180112"), "61401180112");
  assert.equal(validPhoneKey("12345"), null);
  assert.ok(looksTruncatedInternational("1401180112"), "old truncated value is flagged for review");
  assert.ok(!looksTruncatedInternational("9876543210"));
});

test("party names: prefixes, role words and location tags stripped; firm names kept", () => {
  const c = (s: string) => cleanPartyName(s).name;
  assert.equal(c("Cus Rahul Patil, Rahatni"), "Rahul Patil");
  assert.equal(c("Mr. Amit Shah"), "Amit Shah");
  assert.equal(c("Ms Neha (Wakad)"), "Neha");
  assert.equal(c("Dr Mehta Sir"), "Mehta");
  assert.equal(c("Shree Ganesh Traders"), "Ganesh Traders");
  assert.equal(c("M/s Sai Enterprises"), "Sai Enterprises");
  assert.equal(c("Kiran Architect - Baner"), "Kiran");
  // Production patterns (dry run 2026-11-04): prefix before the comma, area without a comma, repeated name.
  assert.equal(c("Cus, Shreyash Nimbalkar, Keshav Nagar"), "Shreyash Nimbalkar");
  assert.equal(c("Cus , Akshay Sahani Hadapsar"), "Akshay Sahani");
  assert.equal(c("Cus , Sunil Bansode M.wadi"), "Sunil Bansode");
  assert.equal(c("Cust, Dr Neha Surana Dr Neha Surana"), "Neha Surana");
  assert.equal(c("Cus Ravi Lal Mahadev Nagar"), "Ravi Lal");
  assert.equal(c("Mehta Viman Nagar Pune"), "Mehta");
  assert.equal(c("Joy Hotel Kharadi"), "Joy Hotel Kharadi", "company names keep their place word");
  assert.equal(c("Ravi Nagar"), "Ravi Nagar", "a two-word name is never cut to one word by the place rule");
  assert.equal(c("rahul sharma ji"), "Rahul Sharma");
  assert.equal(c("Mrinal Sen"), "Mrinal Sen", "'Mr' inside a word is not a prefix");
  assert.equal(c("Shreeya Kulkarni"), "Shreeya Kulkarni");
  assert.equal(c("Padams Interiors"), "Padams Interiors", "firm name untouched");
  assert.equal(c("ABC PVT LTD"), "ABC PVT LTD", "upper-case company names keep their case");
  assert.equal(cleanPartyName("Sunil Broker").suggestedType, "BROKER");
  assert.equal(cleanPartyName("Padams Interiors").suggestedType, "INTERIOR_DESIGNER");
  for (const empty of ["cus", "Mr.", "9876543210", "  ,Rahatni", "Unsaved Contact - 9146220798", "Unsaved Contact - +2349029009904 | Pune", "Mr. U", "Cus Baner"]) assert.equal(c(empty), "", `${empty} → exception log`);
});

test("source tags: full SRC list without the retired Mamurdi tag; old free-text values stay visible", () => {
  assert.equal(SOURCE_TAGS.length, 11);
  assert.ok(!(SOURCE_TAGS as readonly string[]).includes("SRC-GMB-MAMURDI"));
  assert.equal(activeSourceTag("SRC-GMB-MAMURDI"), null);
  assert.equal(activeSourceTag(" SRC-META-ADS "), "SRC-META-ADS");
  assert.ok(sourceTagChoices("Justdial").some((o) => o.value === "Justdial"));
  assert.ok(!sourceTagChoices("SRC-GMB-MAMURDI").some((o) => o.value === "SRC-GMB-MAMURDI"));
  assert.ok((CATEGORY_OPTIONS as readonly string[]).includes("ARCHITECT"), "Architect pickable in the contact-type dropdown");
});

test("vendor commission: default 20 %, clamped to 20–25 %, shares always add up", () => {
  assert.deepEqual(splitCommission(10000), { gross: 10000, commissionPct: 20, saharaShare: 2000, vendorShare: 8000, vendorPct: 80 });
  assert.equal(splitCommission(10000, 25).vendorShare, 7500);
  assert.equal(clampCommission(30), 25);
  assert.equal(clampCommission(10), 20);
  assert.equal(clampCommission("abc"), 20);
  const odd = splitCommission(3999, 22);
  assert.equal(odd.saharaShare + odd.vendorShare, 3999);
});

test("vendor payout books exactly one VENDOR_PAYMENT expense in the same transaction; Finance-only access", () => {
  const src = readFileSync("src/server/actions/vendors.ts", "utf8");
  assert.ok(src.includes('category: "VENDOR_PAYMENT"'));
  assert.ok(src.includes("db.$transaction(async (tx)"));
  assert.ok(/splitCommission\(d\.grossAmount/.test(src), "split recomputed on the server");
  assert.ok(src.includes('role === "ADMIN" || role === "ACCOUNTS"'));
  const page = readFileSync("src/app/(app)/vendors/page.tsx", "utf8");
  assert.ok(page.includes('requireRole(["ADMIN", "ACCOUNTS"])'));
  const ui = readFileSync("src/components/vendors/vendors-explorer.tsx", "utf8");
  assert.ok(ui.includes("hidden overflow-hidden rounded-2xl border shadow-sm md:block") && ui.includes("md:hidden"), "table on desktop, cards on mobile");
  const setup = readFileSync("scripts/db-setup.mjs", "utf8");
  assert.ok(setup.includes('CREATE TABLE IF NOT EXISTS "Vendor"') && setup.includes('ADD COLUMN "sourceTag" TEXT'), "additive migration");
});

test("clean-party-names script: dry run writes nothing; --apply backs up, cleans, logs exceptions; rollback restores", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "party-"));
  const dbFile = path.join(dir, "t.db");
  const db = new Database(dbFile);
  db.exec(`CREATE TABLE "Customer" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "mobile" TEXT NOT NULL UNIQUE, "contactType" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "customerNumber" TEXT, "source" TEXT, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  const ins = db.prepare(`INSERT INTO "Customer" ("id","name","mobile","source") VALUES (?,?,?,?)`);
  ins.run("a", "Cus Rahul, Rahatni", "9876543210", null);
  ins.run("b", "Sunil Broker", "9822012345", "SRC-GMB-MAMURDI");
  ins.run("c", "cus", "9000000001", null);
  ins.run("e", "Customer", "9000000002", null);
  ins.run("d", "John Smith", "1401180112", null);
  db.exec(`CREATE TABLE "Lead" ("id" TEXT PRIMARY KEY, "name" TEXT, "mobile" TEXT, "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.prepare(`INSERT INTO "Lead" VALUES ('l1', 'Mr. Kunal Joshi, Baner', '+91 90000 00002', CURRENT_TIMESTAMP)`).run();
  db.close();
  const run = (...a: string[]) => execFileSync("node", ["scripts/clean-party-names.mjs", ...a], { env: { ...process.env, DATABASE_URL: `file:${dbFile}` }, encoding: "utf8" });
  const names = () => {
    const d = new Database(dbFile, { readonly: true });
    const r = d.prepare(`SELECT "id","name","contactType","source" FROM "Customer" ORDER BY "id"`).all() as { id: string; name: string; contactType: string; source: string | null }[];
    d.close();
    return r;
  };
  const before = names();

  assert.match(run("--dry-run"), /DRY RUN — nothing was changed/);
  assert.deepEqual(names(), before);

  const out = run("--apply", "--apply-types");
  assert.match(out, /Backup verified/);
  const after = names();
  assert.equal(after[0].name, "Rahul");
  assert.deepEqual([after[1].name, after[1].contactType, after[1].source], ["Sunil", "BROKER", null]);
  assert.equal(after[2].name, "cus", "empty result never saved");
  assert.equal(after.find((r) => r.id === "e")!.name, "Kunal Joshi", "empty name recovered from the same mobile's enquiry");
  assert.equal(readdirSync(path.join(dir, "backups")).filter((f) => f.endsWith(".db")).length, 1);
  const runDir = readdirSync(path.join(dir, "party-cleanup")).sort().pop()!;
  const reports = path.join(dir, "party-cleanup", runDir);
  assert.match(readFileSync(path.join(reports, "exceptions.csv"), "utf8"), /^.*\nc,,9000000001/m);
  assert.match(readFileSync(path.join(reports, "phone-review.csv"), "utf8"), /1401180112/);
  assert.deepEqual(JSON.parse(readFileSync(path.join(reports, "exceptions.json"), "utf8")).map((e: { id: string }) => e.id), ["c"]);

  run("--rollback", path.join(reports, "rollback.json"));
  assert.deepEqual(names(), before);
});
