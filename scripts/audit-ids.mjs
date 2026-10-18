// Sahara OS — READ-ONLY ID sequence & link audit.
//
//   node scripts/audit-ids.mjs              (uses DATABASE_URL, default ./dev.db)
//   DATABASE_URL=file:/data/sahara.db node scripts/audit-ids.mjs --json
//
// Opens the database read-only and changes nothing. For Customer (CUST-####), Lead (LD-year-####),
// Job (JOB-year-####), Quotation (QT-year-####) and the shared Payment / Invoice sequence (INV-year-####) it reports
// count, range, duplicates, odd formats and every gap — and, for each gap, whether a soft-deleted or demo row
// could explain it. It also checks the links between tables (job → lead, quotation → lead, payment → job,
// lead / job contacts without a customer record).
//
// It deliberately does NOT renumber anything: these numbers are already printed on customers' quotations,
// invoices and WhatsApp messages and sent to Meta as event ids, so renaming them would break the paper trail.
// A gap is just a number that was never saved or whose row was permanently deleted — harmless, and new numbers
// can no longer collide (lib/id-generators.ts reserves each one before it is used).

import path from "node:path";
import Database from "better-sqlite3";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
const asJson = process.argv.includes("--json");
const db = new Database(dbPath, { readonly: true, fileMustExist: true });

const has = (table, col) => db.prepare(`PRAGMA table_info("${table}")`).all().some((c) => c.name === col);
const all = (sql) => db.prepare(sql).all();

/** Group "PREFIX-YYYY-NNNN" / "CUST-NNNN" numbers by year and find the holes. */
function analyse(label, rows, { prefix, yearly }) {
  const re = yearly ? new RegExp(`^${prefix}-(\\d{4})-(\\d{4,})$`) : new RegExp(`^${prefix}-(\\d{4,})$`);
  const groups = new Map(); // year -> Map(number -> [rows])
  const odd = [];
  for (const r of rows) {
    const m = re.exec(String(r.num ?? ""));
    if (!m) {
      odd.push(r.num);
      continue;
    }
    const year = yearly ? m[1] : "all";
    const n = Number(yearly ? m[2] : m[1]);
    if (!groups.has(year)) groups.set(year, new Map());
    const g = groups.get(year);
    g.set(n, [...(g.get(n) ?? []), r]);
  }
  const years = [];
  for (const [year, g] of [...groups].sort()) {
    const nums = [...g.keys()].sort((a, b) => a - b);
    const gaps = [];
    for (let n = nums[0]; n <= nums.at(-1); n++) if (!g.has(n)) gaps.push(n);
    const dupes = [...g].filter(([, v]) => v.length > 1).map(([n]) => n);
    const flags = {
      softDeleted: [...g].filter(([, v]) => v.every((r) => r.deleted)).length,
      demo: [...g].filter(([, v]) => v.every((r) => r.demo)).length,
    };
    years.push({ year, count: nums.length, first: nums[0], last: nums.at(-1), gapCount: gaps.length, gaps: compress(gaps), duplicates: dupes, ...flags, startsAtOne: nums[0] === 1 });
  }
  return { label, rows: rows.length, odd, years };
}

/** [7,8,9,12] -> "7-9, 12" */
function compress(a) {
  const out = [];
  for (let i = 0; i < a.length; ) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(i === j ? String(a[i]) : `${a[i]}-${a[j]}`);
    i = j + 1;
  }
  return out.join(", ");
}

const cols = (t) => ({
  deleted: has(t, "deletedAt") ? `("deletedAt" IS NOT NULL)` : "0",
  demo: has(t, "isDemo") ? `("isDemo" = 1)` : "0",
});
const q = (table, numCol) => {
  const c = cols(table);
  return all(`SELECT "${numCol}" AS num, ${c.deleted} AS deleted, ${c.demo} AS demo FROM "${table}"`);
};

const report = {
  database: dbPath,
  sequences: [
    has("Customer", "customerNumber") ? analyse("Customer", all(`SELECT "customerNumber" AS num, 0 AS deleted, 0 AS demo FROM "Customer" WHERE "customerNumber" IS NOT NULL`), { prefix: "CUST", yearly: false }) : { label: "Customer", note: "customerNumber column not present yet" },
    analyse("Lead", q("Lead", "leadNumber"), { prefix: "LD", yearly: true }),
    analyse("Job", q("Job", "jobNumber"), { prefix: "JOB", yearly: true }),
    analyse("Quotation", q("Quotation", "quoteNumber"), { prefix: "QT", yearly: true }),
    // Payment rows and standalone Invoices share one INV sequence.
    analyse("Invoice / Payment (shared INV sequence)", [...q("Payment", "invoiceNumber"), ...q("Invoice", "invoiceNumber")], { prefix: "INV", yearly: true }),
  ],
  links: {},
};

const count = (sql) => db.prepare(sql).get().n;
report.links = {
  jobsWithMissingLead: count(`SELECT COUNT(*) n FROM "Job" j WHERE j."leadId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Lead" l WHERE l."id" = j."leadId")`),
  quotationsWithMissingLead: count(`SELECT COUNT(*) n FROM "Quotation" x WHERE NOT EXISTS (SELECT 1 FROM "Lead" l WHERE l."id" = x."leadId")`),
  paymentsWithMissingJob: count(`SELECT COUNT(*) n FROM "Payment" p WHERE p."jobId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Job" j WHERE j."id" = p."jobId")`),
  invoicesWithMissingJob: count(`SELECT COUNT(*) n FROM "Invoice" i WHERE i."jobId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Job" j WHERE j."id" = i."jobId")`),
  liveLeadsWithoutCustomerRecord: has("Customer", "mobile")
    ? count(`SELECT COUNT(DISTINCT substr(replace(replace(replace(l."mobile",' ',''),'+',''),'-',''), -10)) n FROM "Lead" l WHERE l."deletedAt" IS NULL AND length(l."mobile") >= 10 AND NOT EXISTS (SELECT 1 FROM "Customer" c WHERE c."mobile" = substr(replace(replace(replace(l."mobile",' ',''),'+',''),'-',''), -10))`)
    : null,
  customersWithoutNumber: has("Customer", "customerNumber") ? count(`SELECT COUNT(*) n FROM "Customer" WHERE "customerNumber" IS NULL`) : null,
};
db.close();

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`ID audit (read-only) — ${report.database}\n`);
  for (const s of report.sequences) {
    if (s.note) {
      console.log(`${s.label}: ${s.note}\n`);
      continue;
    }
    console.log(`${s.label}: ${s.rows} rows${s.odd.length ? `, ${s.odd.length} with an unexpected format (${s.odd.slice(0, 5).join(", ")})` : ""}`);
    for (const y of s.years) {
      console.log(`  ${y.year}: ${y.count} numbers, ${y.first}…${y.last}${y.startsAtOne ? "" : " (does not start at 1)"}, ${y.gapCount} missing${y.gaps ? ` → ${y.gaps}` : ""}`);
      if (y.duplicates.length) console.log(`    DUPLICATES: ${y.duplicates.join(", ")}`);
      if (y.softDeleted || y.demo) console.log(`    of these, ${y.softDeleted} are in Trash and ${y.demo} are demo records`);
    }
    console.log("");
  }
  console.log("Links:");
  for (const [k, v] of Object.entries(report.links)) console.log(`  ${k}: ${v}`);
  console.log("\nNothing was changed. Missing numbers are rows that were permanently deleted or never saved; they are not renumbered because the numbers are already on customer documents.");
}
