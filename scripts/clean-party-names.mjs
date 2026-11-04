#!/usr/bin/env node
// Sahara OS — one-time party-name clean-up (owner CRM data standard, 2026-11-04).
//
//   node scripts/clean-party-names.mjs                 → DRY RUN (default): writes the preview, changes nothing
//   node scripts/clean-party-names.mjs --dry-run       → same as above
//   node scripts/clean-party-names.mjs --apply         → backup DB, then save the cleaned names
//   node scripts/clean-party-names.mjs --apply --apply-types
//                                                      → also set contactType (BROKER / ARCHITECT / INTERIOR_DESIGNER)
//                                                        where the name said so and the record is still "CUSTOMER"
//   node scripts/clean-party-names.mjs --rollback <dir>/rollback.json
//                                                      → put every name / type back exactly as it was
//
// Safety:
//   • Nothing is written without --apply.
//   • --apply first takes a full online SQLite backup (better-sqlite3 backup API) and verifies
//     it opens with the same Customer row count; if that fails the script stops before any write.
//   • Names that come out empty are NEVER saved — they go to exceptions.csv for manual review.
//   • Every update runs in one transaction (all or nothing) and rollback.json is written first.
//   • Retired source tag SRC-GMB-MAMURDI is cleared from Customer.source (kept in rollback.json).
//   • Phone numbers are only reported here (truncated international numbers can't be rebuilt
//     automatically) — see phone-review.csv.
//
// Reports go to <database folder>/party-cleanup/<timestamp>/ (same persistent volume as the DB).

import Database from "better-sqlite3";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { cleanPartyName } from "../src/lib/party-name.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

const APPLY = has("--apply");
const APPLY_TYPES = has("--apply-types");
const ROLLBACK = valueOf("--rollback");
if (APPLY && has("--dry-run")) {
  console.error("Use either --dry-run or --apply, not both.");
  process.exit(2);
}

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(root, dbUrl.replace(/^file:/, "").replace(/\?.*$/, ""));
if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath} (set DATABASE_URL)`);
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(path.dirname(dbPath), "party-cleanup", stamp);

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const writeCsv = (file, header, rows) =>
  writeFileSync(file, "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");

// Phone checks mirror src/lib/phone.ts (kept inline: this file must run on plain Node 20).
function phoneNote(mobile) {
  const d = String(mobile ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(d)) return { e164: `+91${d}`, issue: "" };
  if (/^[0-5]\d{9}$/.test(d)) return { e164: "", issue: "10 digits not starting 6-9 — likely an international number cut to 10 digits (or a landline); re-enter with country code" };
  if (d.length >= 8 && d.length <= 15 && d.length !== 10) return { e164: `+${d}`, issue: "" };
  return { e164: "", issue: "not a valid phone number" };
}

// ── Rollback ────────────────────────────────────────────────────────────────
if (ROLLBACK) {
  const file = path.resolve(ROLLBACK);
  const rows = JSON.parse(readFileSync(file, "utf8"));
  const db = new Database(dbPath);
  const upd = db.prepare(`UPDATE "Customer" SET "name" = ?, "contactType" = ?, "source" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ?`);
  const tx = db.transaction((list) => {
    let n = 0;
    for (const r of list) n += upd.run(r.name, r.contactType, r.source ?? null, r.id).changes;
    return n;
  });
  const n = tx(rows);
  console.log(`Rollback complete: ${n} of ${rows.length} customers restored from ${file}`);
  db.close();
  process.exit(0);
}

// ── Preview (always) ───────────────────────────────────────────────────────
const db = new Database(dbPath, { readonly: !APPLY });
const customers = db
  .prepare(`SELECT "id", "name", "mobile", "contactType", "customerNumber", "source" FROM "Customer" ORDER BY "createdAt"`)
  .all();

const changes = [];
const exceptions = [];
const phoneReview = [];
let unchanged = 0;
const typeSuggestions = { BROKER: 0, ARCHITECT: 0, INTERIOR_DESIGNER: 0 };
const RETIRED_TAGS = ["SRC-GMB-MAMURDI"];

for (const c of customers) {
  const r = cleanPartyName(c.name);
  const phone = phoneNote(c.mobile);
  if (phone.issue) phoneReview.push([c.id, c.customerNumber ?? "", c.name, c.mobile, phone.issue]);
  if (!r.name) {
    exceptions.push([c.id, c.customerNumber ?? "", c.mobile, phone.e164, c.name, r.removed.join(" | "), "Name empty after cleaning — fix by hand in Parties"]);
    continue;
  }
  const typeTo = r.suggestedType && (!c.contactType || c.contactType === "CUSTOMER") ? r.suggestedType : null;
  if (typeTo) typeSuggestions[typeTo]++;
  const purgeTag = RETIRED_TAGS.includes((c.source ?? "").trim());
  if (!r.changed && !typeTo && !purgeTag) {
    unchanged++;
    continue;
  }
  changes.push({ c, r, typeTo, phone, purgeTag });
}

mkdirSync(outDir, { recursive: true });
writeCsv(
  path.join(outDir, "preview.csv"),
  ["id", "customerNumber", "mobile", "mobileE164", "currentName", "cleanName", "removed", "currentType", "suggestedType", "currentSource", "sourceAfter"],
  changes.map(({ c, r, typeTo, phone, purgeTag }) => [c.id, c.customerNumber ?? "", c.mobile, phone.e164, c.name, r.name, r.removed.join(" | "), c.contactType ?? "", typeTo ?? "", c.source ?? "", purgeTag ? "" : c.source ?? ""]),
);
writeCsv(path.join(outDir, "exceptions.csv"), ["id", "customerNumber", "mobile", "mobileE164", "currentName", "removed", "reason"], exceptions);
writeFileSync(
  path.join(outDir, "exceptions.json"),
  JSON.stringify(exceptions.map(([id, customerNumber, mobile, mobileE164, currentName, removed, reason]) => ({ id, customerNumber, mobile, mobileE164, currentName, removed, reason })), null, 2),
);
writeCsv(path.join(outDir, "phone-review.csv"), ["id", "customerNumber", "name", "storedMobile", "issue"], phoneReview);

const nameChanges = changes.filter((x) => x.r.changed).length;
const tagPurges = changes.filter((x) => x.purgeTag).length;
const summary = {
  mode: APPLY ? (APPLY_TYPES ? "apply+types" : "apply") : "dry-run",
  database: dbPath,
  totalCustomers: customers.length,
  namesToClean: nameChanges,
  unchanged,
  emptyAfterCleaning: exceptions.length,
  contactTypeSuggestions: typeSuggestions,
  contactTypesWillBeSet: APPLY_TYPES,
  retiredSourceTagsToClear: tagPurges,
  phoneNumbersToReview: phoneReview.length,
  reports: outDir,
};
writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));

console.log("\n── Sahara OS · Party-name clean-up ──");
console.table({
  "Total parties": customers.length,
  "Names to clean": nameChanges,
  "Already clean": unchanged,
  "Empty after cleaning (exceptions)": exceptions.length,
  "Type → Broker": typeSuggestions.BROKER,
  "Type → Architect": typeSuggestions.ARCHITECT,
  "Type → Interior Designer": typeSuggestions.INTERIOR_DESIGNER,
  "SRC-GMB-MAMURDI tags to clear": tagPurges,
  "Phone numbers to review": phoneReview.length,
});
console.log("Sample:");
for (const { c, r } of changes.filter((x) => x.r.changed).slice(0, 15)) console.log(`  ${JSON.stringify(c.name)}  →  ${JSON.stringify(r.name)}`);
console.log(`\nReports: ${outDir}\n  preview.csv · exceptions.csv / exceptions.json · phone-review.csv · summary.json`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing was changed. Re-run with --apply to save.\n");
  db.close();
  process.exit(0);
}

// ── Apply ───────────────────────────────────────────────────────────────────
const backupDir = path.join(path.dirname(dbPath), "backups");
mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(backupDir, `pre-party-cleanup-${stamp}.db`);
console.log(`\nBacking up database → ${backupFile}`);
await db.backup(backupFile);
try {
  const check = new Database(backupFile);
  check.pragma("journal_mode = DELETE"); // one self-contained .db file — no -wal / -shm beside it
  const n = check.prepare(`SELECT COUNT(*) AS n FROM "Customer"`).get().n;
  const ok = check.pragma("quick_check", { simple: true });
  check.close();
  if (n !== customers.length || ok !== "ok") throw new Error(`backup check failed (rows ${n}/${customers.length}, ${ok})`);
} catch (e) {
  console.error(`ABORTED before any change — ${e.message}`);
  db.close();
  process.exit(1);
}
console.log("Backup verified.");

const rollback = changes.map(({ c }) => ({ id: c.id, name: c.name, contactType: c.contactType, source: c.source }));
const rollbackFile = path.join(outDir, "rollback.json");
writeFileSync(rollbackFile, JSON.stringify(rollback, null, 1));

const setName = db.prepare(`UPDATE "Customer" SET "name" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "name" = ?`);
const setType = db.prepare(`UPDATE "Customer" SET "contactType" = ?, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND ("contactType" = 'CUSTOMER' OR "contactType" IS NULL)`);
const clearTag = db.prepare(`UPDATE "Customer" SET "source" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ? AND "source" = ?`);
const clearLeadTags = db.prepare(`SELECT 1 FROM pragma_table_info('Lead') WHERE name = 'sourceTag'`).get()
  ? db.prepare(`UPDATE "Lead" SET "sourceTag" = NULL WHERE "sourceTag" IN (${RETIRED_TAGS.map(() => "?").join(",")})`)
  : null;
const hasAudit = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='AuditLog'`).get();
const tx = db.transaction(() => {
  let names = 0;
  let types = 0;
  let tags = 0;
  for (const { c, r, typeTo, purgeTag } of changes) {
    if (r.changed) names += setName.run(r.name, c.id, c.name).changes;
    if (APPLY_TYPES && typeTo) types += setType.run(typeTo, c.id).changes;
    if (purgeTag) tags += clearTag.run(c.id, c.source).changes;
  }
  if (clearLeadTags) tags += clearLeadTags.run(...RETIRED_TAGS).changes;
  if (hasAudit) {
    db.prepare(`INSERT INTO "AuditLog" ("id","entityType","entityId","action","summary","actorName","meta") VALUES (?,?,?,?,?,?,?)`).run(
      randomUUID(), "Customer", "bulk", "UPDATE",
      `Party-name clean-up: ${names} names cleaned, ${types} categories set, ${tags} retired source tags cleared, ${exceptions.length} left for manual review`,
      "scripts/clean-party-names.mjs",
      JSON.stringify({ backupFile, rollbackFile, reports: outDir }),
    );
  }
  return { names, types, tags };
});
const done = tx();
console.log(`\nDONE — ${done.names} names cleaned, ${done.types} categories set, ${done.tags} SRC-GMB-MAMURDI tags cleared.`);
console.log(`Undo any time:  node scripts/clean-party-names.mjs --rollback ${rollbackFile}`);
console.log(`Full restore:   stop the app and copy ${backupFile} over ${dbPath}\n`);
db.close();
