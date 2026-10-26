"use server";

// Khata Book → Staff App migration (Super Admin only).
//
// SAFETY RULES (owner, 2026-10-05):
// - Khata Book is never touched; this only reads an uploaded dataset.
// - Preview first: nothing is written until "Apply".
// - Apply takes an on-server SQLite snapshot BEFORE any write.
// - An employee is migrated only if their Staff App balance after import
//   equals their live Khata Book balance — difference must be ₹0. Otherwise
//   that employee is rolled back (soft-delete) and flagged.
// - Every source row gets a KhataImportLog row; every ledger row keeps its
//   Khata party, row no., exact description and a unique sourceHash
//   (duplicate protection — the same transaction can never be imported twice).
// - Financial rows are never hard-deleted; rollback = soft-delete.

import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateEmployeeCode } from "@/lib/id-generators";
import { getSession } from "@/lib/session";
import { getStaffMoney } from "@/server/staff-balance";

const row = z.object({ row: z.number().int(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), details: z.string(), debit: z.number().min(0), credit: z.number().min(0) });
const employee = z.object({
  khataName: z.string().min(1),
  staffName: z.string().min(1), // exact name used across Staff App
  designation: z.string().default("Housekeeping Staff"),
  dailyWage: z.number().min(0).nullable().default(null),
  salaryType: z.enum(["DAILY", "MONTHLY"]).default("DAILY"),
  monthlySalary: z.number().min(0).nullable().default(null),
  // Owner instruction: part of the Khata party balance is really a loan (e.g.
  // Matin: Rs7,400 "You will get" = loan). Imported as a visible transfer:
  // salary +R ("moved to loan") and loan +R — the Khata total is unchanged.
  reclassToLoan: z.number().min(0).default(0),
  reclassNote: z.string().nullable().default(null),
  // Owner review item (e.g. pay-rule mismatch, suspected duplicate). Blocks the employee until cleared.
  hold: z.string().nullable().default(null),
  ledgerMode: z.enum(["SALARY", "LOAN"]).default("SALARY"),
  liveBalance: z.number().nullable(), // signed: + You will give, − You will get (salary ledger) / + loan outstanding (LOAN mode)
  liveSource: z.string().nullable().default(null),
  openingApproved: z.boolean().default(false),
  linkStaffId: z.string().nullable().default(null), // owner-chosen existing staff when names differ
  createNew: z.boolean().default(false),
  // Owner-approved permanent Employee ID for a NEW staff record (SCS-####). Linked staff keep theirs.
  employeeCode: z.string().regex(/^SCS-\d{4}$/).nullable().default(null),
  entries: z.array(row),
  // Owner decisions on reviewed Khata rows (Khata Book itself is never edited):
  // - dropRows: confirmed duplicates — not imported, logged as OWNER_REMOVED
  // - kindOverrides: re-type a row (e.g. extra Rs350 = auto fare)
  // - adjustments: signed salary corrections (e.g. fixed monthly salary rule)
  // Reconciliation target = live Khata balance − dropped rows + adjustments.
  ownerDecisions: z
    .object({
      dropRows: z.array(z.object({ row: z.number().int(), note: z.string().min(3), alreadyRemovedInKhata: z.boolean().default(false) })).default([]),
      kindOverrides: z.array(z.object({ row: z.number().int(), kind: z.enum(["AUTO_FARE"]), note: z.string().min(3) })).default([]),
      adjustments: z.array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), amount: z.number(), note: z.string().min(3) })).default([]),
    })
    .default({ dropRows: [], kindOverrides: [], adjustments: [] }),
  loan: z
    .object({ khataName: z.string(), liveBalance: z.number().nullable(), liveSource: z.string().nullable().default(null), openingApproved: z.boolean().default(false), entries: z.array(row) })
    .nullable()
    .default(null),
});
const dataset = z.object({
  version: z.literal(1),
  source: z.object({ file: z.string(), rows: z.number().int(), debitTotal: z.number(), creditTotal: z.number() }),
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employees: z.array(employee).max(200),
  excluded: z.array(z.string()).default([]),
});
type Dataset = z.infer<typeof dataset>;
type Emp = z.infer<typeof employee>;
type Row = z.infer<typeof row>;

const r2 = (n: number) => Math.round(n * 100) / 100;
const day = (ymd: string) => new Date(`${ymd}T00:00:00+05:30`);
const hash = (party: string, r: Row, ledger: string) => createHash("sha256").update([ledger, party, r.row, r.date, r.details, r.debit, r.credit].join("|")).digest("hex");

function salaryKind(r: Row) {
  const d = r.details.toLowerCase();
  if (r.credit > 0) return /auto\s*fare/.test(d) ? "AUTO_FARE" : /transfer to loan/.test(d) ? "OTHER_CREDIT" : "EARNING";
  if (/fine|without intimation/.test(d)) return "FINE";
  if (/missing/.test(d)) return "DEDUCTION";
  if (/advance/.test(d)) return "ADVANCE";
  return "PAYMENT";
}
const salarySigned = (r: Row) => r.credit - r.debit; // credit = earned (Sahara owes), debit = paid
const loanSigned = (r: Row) => r.debit - r.credit; // debit = loan given, credit = repaid

async function requireAdmin() {
  const s = await getSession();
  return s?.role === "ADMIN" ? s : null;
}

type Plan = Awaited<ReturnType<typeof planEmployee>>;

async function planEmployee(e: Emp, cutoff: Date) {
  const notes: string[] = [];
  const blocks: string[] = [];
  if (e.hold) blocks.push(`ON HOLD: ${e.hold}`);
  const nonZero = e.entries.filter((r) => r.debit > 0 || r.credit > 0);
  if (nonZero.length !== e.entries.length) notes.push(`${e.entries.length - nonZero.length} zero-amount row(s) skipped`);
  const isLoanMode = e.ledgerMode === "LOAN";
  const od = e.ownerDecisions;
  const dropSet = new Set(od.dropRows.map((d) => d.row));
  for (const d of [...od.dropRows, ...od.kindOverrides]) if (!nonZero.some((r) => r.row === d.row)) blocks.push(`Owner decision refers to row ${d.row}, which is not in this party's Khata rows`);
  if (isLoanMode && (od.dropRows.length || od.kindOverrides.length || od.adjustments.length)) blocks.push("Owner decisions are only supported on salary ledgers");
  const usable = nonZero.filter((r) => !dropSet.has(r.row));
  const dropped = nonZero.filter((r) => dropSet.has(r.row));
  // Khata net (all rows, as Khata Book shows) drives the opening; dropped rows and adjustments move the target.
  // A duplicate the owner already deleted in Khata Book is not part of the live balance:
  // leave it out of the Khata net too (otherwise it would be subtracted twice).
  const goneInKhata = new Set(od.dropRows.filter((d) => d.alreadyRemovedInKhata).map((d) => d.row));
  const net = r2(nonZero.filter((r) => !goneInKhata.has(r.row)).reduce((s, r) => s + (isLoanMode ? loanSigned(r) : salarySigned(r)), 0));
  const droppedNet = r2(dropped.filter((r) => !goneInKhata.has(r.row)).reduce((s, r) => s + salarySigned(r), 0));
  const adjTotal = r2(od.adjustments.reduce((s, a) => s + a.amount, 0));
  for (const d of od.dropRows) notes.push(`Row ${d.row} not imported (owner): ${d.note}`);
  for (const k of od.kindOverrides) notes.push(`Row ${k.row} imported as ${k.kind} (owner): ${k.note}`);
  if (od.adjustments.length) notes.push(`Owner salary adjustments ₹${adjTotal} (${od.adjustments.length} entries)`);

  // Staff match — exact name only; never merge similar names automatically.
  let staff: { id: string; name: string; ledgerCutoverAt: Date | null } | null = null;
  let action: "LINK" | "CREATE" = "CREATE";
  if (e.linkStaffId) {
    staff = await db.staff.findFirst({ where: { id: e.linkStaffId, deletedAt: null }, select: { id: true, name: true, ledgerCutoverAt: true } });
    if (!staff) blocks.push("Chosen staff record not found");
    else action = "LINK";
  } else {
    const exact = await db.staff.findMany({ where: { name: e.staffName, deletedAt: null }, select: { id: true, name: true, ledgerCutoverAt: true } });
    if (exact.length > 1) blocks.push(`${exact.length} staff records named exactly "${e.staffName}" — choose one`);
    else if (exact.length === 1) {
      staff = exact[0];
      action = "LINK";
    } else {
      // Given name only (after an "HK" prefix) — surnames like "Shaikh" are shared by many workers.
      const tokens = e.staffName.replace(/^hk\s+/i, "").split(/\s+/).filter((t) => t.length >= 3).slice(0, 1);
      const similar = tokens.length
        ? await db.staff.findMany({ where: { deletedAt: null, OR: tokens.map((t) => ({ name: { contains: t } })) }, select: { id: true, name: true }, take: 5 })
        : [];
      if (similar.length && !e.createNew) blocks.push(`No exact name match; similar staff: ${similar.map((s) => s.name).join(", ")} — choose one or confirm "create new"`);
    }
  }
  if (staff?.ledgerCutoverAt) blocks.push("This staff member already has imported Khata history (already migrated)");
  if (!staff && e.employeeCode) {
    const taken = await db.staff.findFirst({ where: { employeeCode: e.employeeCode }, select: { name: true } });
    if (taken) blocks.push(`Employee ID ${e.employeeCode} already belongs to ${taken.name}`);
  }

  // Duplicate protection.
  const hashes = usable.map((r) => hash(e.khataName, r, isLoanMode ? "LOAN" : "SALARY"));
  const loanRows = (e.loan?.entries ?? []).filter((r) => r.debit > 0 || r.credit > 0);
  const loanHashes = loanRows.map((r) => hash(e.loan!.khataName, r, "LOAN"));
  const [dupL, dupLoan] = await Promise.all([
    db.staffLedgerEntry.count({ where: { deletedAt: null, sourceHash: { in: isLoanMode ? [] : hashes } } }),
    db.staffLoanEntry.count({ where: { deletedAt: null, sourceHash: { in: [...(isLoanMode ? hashes : []), ...loanHashes] } } }),
  ]);
  if (dupL + dupLoan > 0) blocks.push(`${dupL + dupLoan} row(s) already imported earlier`);

  // Balance target (₹0 rule).
  let opening = 0;
  if (e.liveBalance == null) blocks.push("Live Khata Book balance not provided");
  else {
    opening = r2(e.liveBalance - net);
    if (opening !== 0 && !e.openingApproved) blocks.push(`Opening balance ₹${opening} carried from before the PDF period needs owner approval`);
  }
  let loanOpening = 0;
  const loanNet = r2(loanRows.reduce((s, r) => s + loanSigned(r), 0));
  if (e.loan) {
    if (e.loan.liveBalance == null) blocks.push(`Live balance for ${e.loan.khataName} not provided`);
    else {
      loanOpening = r2(e.loan.liveBalance - loanNet);
      if (loanOpening !== 0 && !e.loan.openingApproved) blocks.push(`Loan opening ₹${loanOpening} (${e.loan.khataName}) needs owner approval`);
    }
  }

  // Native Staff App records on/before the cutover stop counting once Khata history is imported — report them.
  if (staff) {
    const [att, adv, paid] = await Promise.all([
      db.attendance.count({ where: { staffId: staff.id, date: { lte: cutoff } } }),
      db.advance.count({ where: { staffId: staff.id, givenAt: { lte: cutoff } } }),
      db.expense.count({ where: { staffId: staff.id, category: "SALARY", deletedAt: null, date: { lte: cutoff } } }),
    ]);
    if (att + adv + paid) notes.push(`${att} attendance / ${adv} advance / ${paid} salary-paid record(s) up to the cutover stay visible but no longer count — Khata Book covers that period`);
    const after = await getStaffMoney(staff.id);
    if (after && (await db.attendance.count({ where: { staffId: staff.id, date: { gt: cutoff } } })) > 0) notes.push("Has Staff App attendance after the cutover — it will be added on top");
  }

  const R = isLoanMode ? 0 : e.reclassToLoan;
  if (R > 0 && !e.reclassNote) blocks.push("Loan reclassification needs the owner's note");
  const ledgerTotal = isLoanMode ? 0 : r2(net + opening + R - droppedNet + adjTotal);
  const status = blocks.length ? "BLOCKED" : "READY";
  return {
    khataName: e.khataName,
    staffName: e.staffName,
    action,
    staffId: staff?.id ?? null,
    existingName: staff?.name ?? null,
    mode: e.ledgerMode,
    rows: usable.length,
    net,
    opening,
    liveBalance: e.liveBalance,
    liveSource: e.liveSource,
    expectedSalaryDue: isLoanMode ? null : ledgerTotal,
    droppedNet,
    adjTotal,
    reclassToLoan: R,
    loan:
      e.loan || isLoanMode || R > 0
        ? { party: e.loan?.khataName ?? (isLoanMode ? e.khataName : "owner reclassification"), net: isLoanMode ? net : loanNet, opening: isLoanMode ? opening : loanOpening, live: isLoanMode ? e.liveBalance : r2((e.loan?.liveBalance ?? 0) + R) }
        : null,
    status,
    blocks,
    notes,
  };
}

/** Dry run: validate the dataset and show per-employee reconciliation. Writes only the batch record (status PREVIEW). */
export async function previewKhataImport(json: string) {
  const session = await requireAdmin();
  if (!session) return { error: "Super Admin only." };
  let ds: Dataset;
  try {
    ds = dataset.parse(JSON.parse(json));
  } catch (e) {
    return { error: `Dataset is not valid: ${e instanceof Error ? e.message.slice(0, 300) : "parse error"}` };
  }
  const names = ds.employees.map((e) => e.staffName);
  const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupNames.length) return { error: `Same staff name twice in dataset: ${[...new Set(dupNames)].join(", ")}` };
  const leaked = ds.employees.filter((e) => ds.excluded.includes(e.khataName));
  if (leaked.length) return { error: `Excluded party in dataset: ${leaked.map((e) => e.khataName).join(", ")}` };

  const cutoff = new Date(`${ds.cutoffDate}T23:59:59+05:30`);
  const plans: Plan[] = [];
  for (const e of ds.employees) plans.push(await planEmployee(e, cutoff));
  const batch = await db.khataImportBatch.create({
    data: { status: "PREVIEW", cutoffDate: cutoff, sourceName: ds.source.file, sourceRows: ds.source.rows, datasetJson: json, previewJson: JSON.stringify(plans), createdByName: session.name },
  });
  return { ok: true, batchId: batch.id, plans, excluded: ds.excluded };
}

async function snapshotDatabase(batchId: string) {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
  const dir = path.join(path.dirname(dbPath), "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `pre-khata-import-${new Date().toISOString().replace(/[:.]/g, "-")}-${batchId}.db`);
  const src = new Database(dbPath, { readonly: true });
  try {
    await src.backup(file);
  } finally {
    src.close();
  }
  const check = new Database(file, { readonly: true });
  const ok = check.pragma("integrity_check", { simple: true }) === "ok";
  check.close();
  if (!ok) throw new Error("Snapshot integrity check failed");
  return { file, size: fs.statSync(file).size };
}

/** Apply a previewed batch: snapshot → migrate READY employees one by one → verify ₹0 → roll back any mismatch. */
export async function applyKhataImport(batchId: string) {
  const session = await requireAdmin();
  if (!session) return { error: "Super Admin only." };
  const batch = await db.khataImportBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.status !== "PREVIEW") return { error: "Run a fresh preview first." };
  const ds = dataset.parse(JSON.parse(batch.datasetJson));
  const cutoff = batch.cutoffDate;

  // 1. Snapshot before any financial write.
  let snap: { file: string; size: number };
  try {
    snap = await snapshotDatabase(batch.id);
    await db.backupEvent.create({ data: { kind: "MANUAL", triggeredBy: session.name, fileName: path.basename(snap.file), sizeBytes: snap.size, notes: `Pre Khata import snapshot (batch ${batch.id})` } });
  } catch (e) {
    await db.khataImportBatch.update({ where: { id: batch.id }, data: { status: "FAILED", resultJson: JSON.stringify({ error: `Snapshot failed: ${String(e)}` }) } });
    return { error: "Could not create the safety snapshot — nothing was changed." };
  }

  const results: { mode?: string; staffName: string; khataName: string; status: string; khata: number | null; app: number | null; diff: number | null; loanKhata?: number | null; loanApp?: number | null; message?: string }[] = [];
  for (const e of ds.employees) {
    const plan = await planEmployee(e, cutoff); // re-check at apply time
    if (plan.status !== "READY") {
      results.push({ staffName: e.staffName, khataName: e.khataName, status: "BLOCKED", khata: e.liveBalance, app: null, diff: null, message: plan.blocks.join("; ") });
      await db.khataImportLog.create({ data: { batchId: batch.id, party: e.khataName, staffName: e.staffName, status: "BLOCKED", message: plan.blocks.join("; ") } });
      continue;
    }
    const isLoanMode = e.ledgerMode === "LOAN";
    let staffId = plan.staffId;
    try {
      const newCode = staffId ? null : (e.employeeCode ?? (await generateEmployeeCode()));
      await db.$transaction(async (tx) => {
        if (!staffId) {
          const s = await tx.staff.create({
            data: {
              employeeCode: newCode!,
              name: e.staffName,
              mobile: "",
              designation: e.designation,
              salaryType: e.salaryType,
              dailyWage: e.dailyWage,
              monthlySalary: e.monthlySalary,
              notes: `Created from Khata Book party "${e.khataName}" (import ${batch.id})`,
            },
          });
          staffId = s.id;
        }
        else {
          // Owner-provided pay settings for payroll after the cutover.
          await tx.staff.update({ where: { id: staffId }, data: { salaryType: e.salaryType, dailyWage: e.dailyWage, monthlySalary: e.monthlySalary, designation: e.designation, isActive: true } });
        }
        const usable = e.entries.filter((r) => r.debit > 0 || r.credit > 0);
        if (!isLoanMode) {
          const kindOverride = new Map(e.ownerDecisions.kindOverrides.map((k) => [k.row, k] as const));
          const usable = e.entries.filter((r) => (r.debit > 0 || r.credit > 0) && !e.ownerDecisions.dropRows.some((d) => d.row === r.row));
          for (const d of e.ownerDecisions.dropRows) {
            const r = e.entries.find((x) => x.row === d.row)!;
            await tx.khataImportLog.create({ data: { batchId: batch.id, party: e.khataName, staffId, staffName: e.staffName, sourceRow: r.row, date: day(r.date), amount: r.credit || r.debit, type: "OWNER_REMOVED", description: `${r.details} — ${d.note}`, status: "SKIPPED" } });
          }
          for (const r of usable) {
            const ko = kindOverride.get(r.row);
            const kind = ko ? ko.kind : salaryKind(r);
            const signed = salarySigned(r);
            const created = await tx.staffLedgerEntry.create({
              data: { staffId: staffId!, date: day(r.date), kind, amount: Math.abs(signed), signedAmount: signed, description: ko ? `${r.details} (${ko.note})` : r.details, source: "KHATABOOK", sourceParty: e.khataName, sourceRow: r.row, sourceHash: hash(e.khataName, r, "SALARY"), batchId: batch.id, createdByName: session.name },
            });
            await tx.khataImportLog.create({ data: { batchId: batch.id, party: e.khataName, staffId, staffName: e.staffName, sourceRow: r.row, date: day(r.date), amount: r.credit || r.debit, type: kind, description: r.details, destination: `StaffLedgerEntry:${created.id}`, status: "MIGRATED" } });
          }
          for (const a of e.ownerDecisions.adjustments) {
            const created = await tx.staffLedgerEntry.create({
              data: { staffId: staffId!, date: day(a.date), kind: "OWNER_ADJUSTMENT", amount: Math.abs(a.amount), signedAmount: a.amount, description: a.note, reason: a.note, source: "OWNER_DECISION", sourceParty: e.khataName, batchId: batch.id, createdByName: session.name },
            });
            await tx.khataImportLog.create({ data: { batchId: batch.id, party: e.khataName, staffId, staffName: e.staffName, date: day(a.date), amount: a.amount, type: "OWNER_ADJUSTMENT", description: a.note, destination: `StaffLedgerEntry:${created.id}`, status: "MIGRATED" } });
          }
          if (plan.opening !== 0) {
            const created = await tx.staffLedgerEntry.create({
              data: { staffId: staffId!, date: day("2026-01-01"), kind: "OPENING_BALANCE", amount: Math.abs(plan.opening), signedAmount: plan.opening, description: `Opening balance carried in Khata Book before the imported period (owner approved; live balance source: ${e.liveSource ?? "—"})`, source: "KHATABOOK", sourceParty: e.khataName, batchId: batch.id, createdByName: session.name },
            });
            await tx.khataImportLog.create({ data: { batchId: batch.id, party: e.khataName, staffId, staffName: e.staffName, amount: plan.opening, type: "OPENING_BALANCE", destination: `StaffLedgerEntry:${created.id}`, status: "MIGRATED" } });
          }
        }
        if (!isLoanMode && e.reclassToLoan > 0) {
          const R = e.reclassToLoan;
          const a = await tx.staffLedgerEntry.create({
            data: { staffId: staffId!, date: day(ds.cutoffDate), kind: "TRANSFER_TO_LOAN", amount: R, signedAmount: R, description: `Moved to loan: ${e.reclassNote}`, source: "KHATABOOK", sourceParty: e.khataName, batchId: batch.id, createdByName: session.name },
          });
          const b = await tx.staffLoanEntry.create({
            data: { staffId: staffId!, date: day(ds.cutoffDate), kind: "LOAN_GIVEN", amount: R, signedAmount: R, description: `From Khata balance: ${e.reclassNote}`, source: "KHATABOOK", sourceParty: e.khataName, batchId: batch.id, createdByName: session.name },
          });
          await tx.khataImportLog.create({ data: { batchId: batch.id, party: e.khataName, staffId, staffName: e.staffName, amount: R, type: "TRANSFER_TO_LOAN", description: e.reclassNote, destination: `StaffLedgerEntry:${a.id} + StaffLoanEntry:${b.id}`, status: "MIGRATED" } });
        }
        const loanParty = isLoanMode ? e.khataName : e.loan?.khataName;
        const loanRows = isLoanMode ? usable : (e.loan?.entries ?? []).filter((r) => r.debit > 0 || r.credit > 0);
        for (const r of loanRows) {
          const signed = loanSigned(r);
          const created = await tx.staffLoanEntry.create({
            data: { staffId: staffId!, date: day(r.date), kind: signed > 0 ? "LOAN_GIVEN" : "LOAN_REPAID", amount: Math.abs(signed), signedAmount: signed, description: r.details, source: "KHATABOOK", sourceParty: loanParty, sourceRow: r.row, sourceHash: hash(loanParty!, r, "LOAN"), batchId: batch.id, createdByName: session.name },
          });
          await tx.khataImportLog.create({ data: { batchId: batch.id, party: loanParty!, staffId, staffName: e.staffName, sourceRow: r.row, date: day(r.date), amount: r.debit || r.credit, type: signed > 0 ? "LOAN_GIVEN" : "LOAN_REPAID", description: r.details, destination: `StaffLoanEntry:${created.id}`, status: "MIGRATED" } });
        }
        const lOpen = plan.loan?.opening ?? 0;
        if (lOpen !== 0) {
          const created = await tx.staffLoanEntry.create({
            data: { staffId: staffId!, date: day("2026-01-01"), kind: "LOAN_OPENING", amount: Math.abs(lOpen), signedAmount: lOpen, description: "Loan balance carried in Khata Book before the imported period (owner approved)", source: "KHATABOOK", sourceParty: loanParty, batchId: batch.id, createdByName: session.name },
          });
          await tx.khataImportLog.create({ data: { batchId: batch.id, party: loanParty!, staffId, staffName: e.staffName, amount: lOpen, type: "LOAN_OPENING", destination: `StaffLoanEntry:${created.id}`, status: "MIGRATED" } });
        }
        await tx.staff.update({ where: { id: staffId! }, data: { ledgerCutoverAt: cutoff } });
      });
    } catch (err) {
      results.push({ staffName: e.staffName, khataName: e.khataName, status: "FAILED", khata: e.liveBalance, app: null, diff: null, message: String(err).slice(0, 300) });
      await db.khataImportLog.create({ data: { batchId: batch.id, party: e.khataName, staffName: e.staffName, status: "FAILED", message: String(err).slice(0, 500) } });
      continue; // the transaction rolled back automatically
    }

    // 2. Reconcile — Staff App must equal Khata Book to the rupee.
    const money = await getStaffMoney(staffId!);
    const R = isLoanMode ? 0 : e.reclassToLoan;
    const app = isLoanMode ? money!.loan.remaining : money!.salaryDue;
    const target = isLoanMode ? (e.liveBalance ?? 0) : (plan.expectedSalaryDue ?? 0);
    const diff = r2((app ?? 0) - target);
    const loanApp = !isLoanMode && (e.loan || R > 0) ? money!.loan.remaining : undefined;
    const loanDiff = loanApp !== undefined ? r2(loanApp - ((e.loan?.liveBalance ?? 0) + R)) : 0;
    if (diff !== 0 || loanDiff !== 0) {
      await compensate(batch.id, staffId!, session.name, plan.staffId == null);
      results.push({ mode: e.ledgerMode, staffName: e.staffName, khataName: e.khataName, status: "ROLLED_BACK", khata: e.liveBalance, app, diff, loanKhata: e.loan?.liveBalance ?? null, loanApp: loanApp ?? null, message: `Difference ₹${diff}${loanDiff ? ` / loan ₹${loanDiff}` : ""} — employee rolled back` });
    } else {
      results.push({ mode: e.ledgerMode, staffName: e.staffName, khataName: e.khataName, status: "MIGRATED", khata: e.liveBalance, app, diff, loanKhata: e.loan?.liveBalance ?? null, loanApp: loanApp ?? null });
    }
  }

  const migrated = results.filter((r) => r.status === "MIGRATED").length;
  await db.khataImportBatch.update({
    where: { id: batch.id },
    data: { status: migrated === ds.employees.length ? "APPLIED" : migrated > 0 ? "PARTIAL" : "FAILED", appliedAt: new Date(), snapshotFile: snap.file, resultJson: JSON.stringify(results) },
  });
  revalidatePath("/admin/khata-import");
  revalidatePath("/staff");
  return { ok: true, results, snapshot: path.basename(snap.file) };
}

/** Soft-delete everything one batch wrote for one staff member and clear their cutover. */
async function compensate(batchId: string, staffId: string, by: string, createdByBatch: boolean) {
  const now = new Date();
  // Soft-delete (rows stay for audit) and release each row's sourceHash so a
  // corrected re-import of the same Khata transaction is possible later.
  await db.$executeRaw`UPDATE "StaffLedgerEntry" SET "sourceHash" = "sourceHash" || ':rolledback:' || ${batchId} WHERE "batchId" = ${batchId} AND "staffId" = ${staffId} AND "deletedAt" IS NULL AND "sourceHash" IS NOT NULL`;
  await db.$executeRaw`UPDATE "StaffLoanEntry" SET "sourceHash" = "sourceHash" || ':rolledback:' || ${batchId} WHERE "batchId" = ${batchId} AND "staffId" = ${staffId} AND "deletedAt" IS NULL AND "sourceHash" IS NOT NULL`;
  await db.$transaction([
    db.staffLedgerEntry.updateMany({ where: { batchId, staffId, deletedAt: null }, data: { deletedAt: now, deletedByName: `${by} (import rollback)` } }),
    db.staffLoanEntry.updateMany({ where: { batchId, staffId, deletedAt: null }, data: { deletedAt: now, deletedByName: `${by} (import rollback)` } }),
    db.staff.update({ where: { id: staffId }, data: { ledgerCutoverAt: null, ...(createdByBatch ? { isActive: false } : {}) } }),
    db.khataImportLog.updateMany({ where: { batchId, staffId, status: "MIGRATED" }, data: { status: "ROLLED_BACK" } }),
  ]);
}

/** Roll back a whole applied batch (soft-delete only; snapshot stays available for a full restore). */
export async function rollbackKhataImport(batchId: string) {
  const session = await requireAdmin();
  if (!session) return { error: "Super Admin only." };
  const batch = await db.khataImportBatch.findUnique({ where: { id: batchId } });
  if (!batch || !["APPLIED", "PARTIAL"].includes(batch.status)) return { error: "Only an applied batch can be rolled back." };
  const staffIds = [
    ...new Set([
      ...(await db.staffLedgerEntry.findMany({ where: { batchId, deletedAt: null }, select: { staffId: true } })).map((x) => x.staffId),
      ...(await db.staffLoanEntry.findMany({ where: { batchId, deletedAt: null }, select: { staffId: true } })).map((x) => x.staffId),
    ]),
  ];
  for (const id of staffIds) {
    const s = await db.staff.findUnique({ where: { id }, select: { notes: true } });
    await compensate(batchId, id, session.name, Boolean(s?.notes?.includes(`(import ${batchId})`)));
  }
  await db.khataImportBatch.update({ where: { id: batchId }, data: { status: "ROLLED_BACK", rolledBackAt: new Date() } });
  revalidatePath("/admin/khata-import");
  return { ok: true, staff: staffIds.length };
}

export async function listKhataBatches() {
  if (!(await requireAdmin())) return [];
  return db.khataImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, status: true, sourceName: true, sourceRows: true, createdByName: true, createdAt: true, appliedAt: true, rolledBackAt: true, resultJson: true, snapshotFile: true },
  });
}
