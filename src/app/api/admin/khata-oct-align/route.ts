import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getStaffBalanceAsOf } from "@/server/staff-balance";
import { isMonthClosed } from "@/server/attendance";
import { EMPLOYEE_ID_MASTER } from "@/server/employee-id-master";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;
const TAG = "khata-oct-align:2026-11-08";
// India time = UTC+5:30. Closings are "as of start of the next day".
const IST_MS = 5.5 * 3600 * 1000;
const istMidnight = (y: number, m1: number, d: number) => new Date(Date.UTC(y, m1 - 1, d) - IST_MS);
const OCT31_END = istMidnight(2026, 11, 1); // entries before this = on/before 31 Oct
const NOV7_END = istMidnight(2026, 11, 8); // entries before this = on/before 7 Nov
const OCT_ROW_DATE = new Date(istMidnight(2026, 11, 1).getTime() - 60 * 1000); // 31 Oct 23:59 IST
const NOV_ROW_DATE = new Date(istMidnight(2026, 11, 8).getTime() - 60 * 1000); // 7 Nov 23:59 IST

type Target = {
  employeeCode: string;
  /** Khatabook closing balance on 31 Oct (+ = Sahara owes the worker). */
  khata31Oct: number;
  /** Khatabook closing balance on 7 Nov. */
  khata7Nov: number;
  /** Set when the Khata balance also contains a loan: salary target = khata + loan remaining on that date. */
  loanInKhata?: boolean;
};

/** Khatabook name → CRM code for the one ledger the owner explicitly mapped (2026-11-08). */
const KHATA_ALIAS: Record<string, string> = { "hk mahesh": "SCS-0001" };

async function snapshot() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
  const dir = path.join(path.dirname(dbPath), "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `pre-khata-oct-align-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  const src = new Database(dbPath, { readonly: true });
  try { await src.backup(file); } finally { src.close(); }
  const chk = new Database(file, { readonly: true });
  const ok = chk.pragma("integrity_check", { simple: true }) === "ok";
  chk.close();
  if (!ok) throw new Error("Snapshot integrity check failed");
  return { file, size: fs.statSync(file).size };
}

/**
 * Super Admin only. Owner decision 2026-11-08: Khatabook (Shoaib enters there first) is the primary source of truth;
 * 31 Oct and 7 Nov Khatabook closings are the master reference.
 *
 * POST { mode: "dry" | "apply", targets: [...] }   — DRY RUN IS THE DEFAULT; anything other than "apply" writes nothing.
 *
 * Per person (only OWNER_ADJUSTMENT rows, never touches attendance/advances/payments):
 *   octAdj = target(31 Oct) − CRM closing(31 Oct)                 → one row dated 31 Oct 23:59 IST
 *   novAdj = (target(7 Nov) − CRM closing(7 Nov)) − octAdj         → one row dated 7 Nov 23:59 IST
 * so both closings equal Khatabook, and later balances only move by the genuine difference.
 * Apply order: snapshot → write rows per person → re-read both closings → if either is not ₹0 off, soft-delete that
 * person's rows (rollback). Idempotent via unique sourceHash. Also refuses (apply) if October is month-closed.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  let body: { mode?: string; targets?: Target[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const apply = body.mode === "apply";
  const targets = (body.targets ?? []).slice(0, 30);

  const octClosed = await isMonthClosed(2026, 10).catch(() => false);
  if (apply && octClosed) {
    return NextResponse.json({ error: "October 2026 is month-closed. Reopen it as Super Admin first; nothing changed." }, { status: 409 });
  }

  let snap: { file: string; size: number } | null = null;
  if (apply) {
    try {
      snap = await snapshot();
      await db.backupEvent.create({ data: { kind: "MANUAL", triggeredBy: session.name, fileName: path.basename(snap.file), sizeBytes: snap.size, notes: "Pre Khata Oct-31 alignment snapshot (owner: Khatabook is source of truth)" } });
    } catch (e) {
      return NextResponse.json({ error: `Snapshot failed, nothing changed: ${String(e).slice(0, 200)}` }, { status: 500 });
    }
  }

  const results = [];
  for (const t of targets) {
    const code = KHATA_ALIAS[String(t.employeeCode).toLowerCase()] ?? t.employeeCode;
    const master = EMPLOYEE_ID_MASTER.find((m) => m.code === code);
    const staff = await db.staff.findFirst({ where: { employeeCode: code, deletedAt: null }, select: { id: true, name: true } });
    if (!staff) { results.push({ code, status: "NOT_FOUND" }); continue; }
    const c31 = await getStaffBalanceAsOf(staff.id, OCT31_END);
    const c7 = await getStaffBalanceAsOf(staff.id, NOV7_END);
    if (!c31 || !c7) { results.push({ code, name: staff.name, status: "NO_MONEY" }); continue; }
    const target31 = r2(t.khata31Oct + (t.loanInKhata ? c31.loanRemaining : 0));
    const target7 = r2(t.khata7Nov + (t.loanInKhata ? c7.loanRemaining : 0));
    const octAdj = r2(target31 - c31.salaryDue);
    const novAdj = r2(target7 - c7.salaryDue - octAdj);
    const base = {
      code, name: staff.name, khataName: master?.khataName ?? null,
      crm31Oct: c31.salaryDue, khata31Oct: target31, octAdj,
      crm7Nov: c7.salaryDue, khata7Nov: target7, novAdj,
    };
    if (octAdj === 0 && novAdj === 0) { results.push({ ...base, status: "NO_CHANGE" }); continue; }
    if (!apply) { results.push({ ...base, status: "WOULD_CORRECT", after31Oct: target31, after7Nov: target7 }); continue; }

    const hOct = `${TAG}:${code}:oct`, hNov = `${TAG}:${code}:nov`;
    if (await db.staffLedgerEntry.findUnique({ where: { sourceHash: hOct } }) || await db.staffLedgerEntry.findUnique({ where: { sourceHash: hNov } })) {
      results.push({ ...base, status: "ALREADY_APPLIED" }); continue;
    }
    const mk = async (amount: number, date: Date, hash: string, label: string) => {
      if (amount === 0) return null;
      const note = `Khatabook is the source of truth (owner decision 2026-11-08): ${label} aligned to Khatabook closing`;
      return db.staffLedgerEntry.create({
        data: { staffId: staff.id, date, kind: "OWNER_ADJUSTMENT", amount: Math.abs(amount), signedAmount: amount, description: note, reason: note, source: "OWNER_DECISION", sourceHash: hash, createdByName: session.name },
      });
    };
    const rows = [await mk(octAdj, OCT_ROW_DATE, hOct, "31 Oct closing"), await mk(novAdj, NOV_ROW_DATE, hNov, "7 Nov closing")].filter(Boolean) as { id: string }[];
    const a31 = await getStaffBalanceAsOf(staff.id, OCT31_END);
    const a7 = await getStaffBalanceAsOf(staff.id, NOV7_END);
    if (!a31 || !a7 || r2(a31.salaryDue - target31) !== 0 || r2(a7.salaryDue - target7) !== 0) {
      for (const [i, row] of rows.entries()) {
        await db.staffLedgerEntry.update({ where: { id: row.id }, data: { deletedAt: new Date(), deletedByName: `${session.name} (oct-align rollback)`, sourceHash: `${TAG}:${code}:rolledback${i}` } });
      }
      results.push({ ...base, status: "ROLLED_BACK", after31Oct: a31?.salaryDue ?? null, after7Nov: a7?.salaryDue ?? null });
    } else {
      results.push({ ...base, status: "ALIGNED", after31Oct: a31.salaryDue, after7Nov: a7.salaryDue });
    }
  }

  if (apply) {
    await db.auditLog.create({ data: { entityType: "StaffLedger", entityId: TAG, action: "CORRECTION", summary: `Khata Oct-31 align: ${results.filter((r) => r.status === "ALIGNED").length} aligned, ${results.filter((r) => r.status === "ROLLED_BACK").length} rolled back (snapshot ${snap ? path.basename(snap.file) : "-"})`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  }
  const touched = results.filter((r) => r.status === "WOULD_CORRECT" || r.status === "ALIGNED" || r.status === "ROLLED_BACK");
  return NextResponse.json({
    ok: true, mode: apply ? "apply" : "dry", octoberClosed: octClosed, snapshot: snap ? path.basename(snap.file) : null,
    summary: { people: results.length, toChange: touched.length, netLiveEffect: r2(touched.reduce((s, r) => s + ((r as { octAdj?: number }).octAdj ?? 0) + ((r as { novAdj?: number }).novAdj ?? 0), 0)) },
    results,
  });
}
