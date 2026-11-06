import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getStaffMoney } from "@/server/staff-balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;
const TAG = "khata-correct:2026-11-07";

async function snapshot() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
  const dir = path.join(path.dirname(dbPath), "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `pre-khata-correct-${new Date().toISOString().replace(/[:.]/g, "-")}.db`);
  const src = new Database(dbPath, { readonly: true });
  try { await src.backup(file); } finally { src.close(); }
  const chk = new Database(file, { readonly: true });
  const ok = chk.pragma("integrity_check", { simple: true }) === "ok";
  chk.close();
  if (!ok) throw new Error("Snapshot integrity check failed");
  return { file, size: fs.statSync(file).size };
}

/**
 * Super Admin only. Owner decision 2026-11-07: Khatabook is the single source of truth.
 * POST { mode: "dry" | "apply", targets: [{ employeeCode, khataBalance }] }
 * khataBalance = live Khatabook balance (+ Sahara owes). For staff whose Khata balance also contains a loan
 * (loanInKhata: true) the salary target is khataBalance + loan remaining.
 * Apply: snapshot first → one OWNER_ADJUSTMENT ledger row per person → verify Salary Due equals the target to the rupee,
 * otherwise soft-delete that row (rollback). Idempotent (unique sourceHash per person).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  let body: { mode?: string; targets?: { employeeCode: string; khataBalance: number; loanInKhata?: boolean }[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const apply = body.mode === "apply";
  const targets = (body.targets ?? []).slice(0, 30);
  let snap: { file: string; size: number } | null = null;
  if (apply) {
    try {
      snap = await snapshot();
      await db.backupEvent.create({ data: { kind: "MANUAL", triggeredBy: session.name, fileName: path.basename(snap.file), sizeBytes: snap.size, notes: "Pre Khata-correction snapshot (owner: Khatabook is source of truth)" } });
    } catch (e) {
      return NextResponse.json({ error: `Snapshot failed, nothing changed: ${String(e).slice(0, 200)}` }, { status: 500 });
    }
  }
  const results = [];
  for (const t of targets) {
    const staff = await db.staff.findFirst({ where: { employeeCode: t.employeeCode, deletedAt: null }, select: { id: true, name: true } });
    if (!staff) { results.push({ code: t.employeeCode, status: "NOT_FOUND" }); continue; }
    const before = await getStaffMoney(staff.id);
    if (!before) { results.push({ code: t.employeeCode, status: "NO_MONEY" }); continue; }
    const target = r2(t.khataBalance + (t.loanInKhata ? before.loan.remaining : 0));
    const diff = r2(target - before.salaryDue);
    if (!apply) { results.push({ code: t.employeeCode, name: staff.name, before: before.salaryDue, target, correction: diff, status: diff === 0 ? "NO_CHANGE" : "WOULD_CORRECT" }); continue; }
    if (diff === 0) { results.push({ code: t.employeeCode, name: staff.name, status: "NO_CHANGE" }); continue; }
    const hash = `${TAG}:${t.employeeCode}`;
    if (await db.staffLedgerEntry.findUnique({ where: { sourceHash: hash } })) { results.push({ code: t.employeeCode, name: staff.name, status: "ALREADY_APPLIED" }); continue; }
    const note = `Khatabook is the source of truth (owner decision 2026-11-07): CRM Salary Due ₹${before.salaryDue} corrected to ₹${target}`;
    const row = await db.staffLedgerEntry.create({
      data: { staffId: staff.id, date: new Date(), kind: "OWNER_ADJUSTMENT", amount: Math.abs(diff), signedAmount: diff, description: note, reason: note, source: "OWNER_DECISION", sourceHash: hash, createdByName: session.name },
    });
    const after = await getStaffMoney(staff.id);
    if (!after || r2(after.salaryDue - target) !== 0) {
      await db.staffLedgerEntry.update({ where: { id: row.id }, data: { deletedAt: new Date(), deletedByName: `${session.name} (correction rollback)`, sourceHash: `${hash}:rolledback` } });
      results.push({ code: t.employeeCode, name: staff.name, status: "ROLLED_BACK", before: before.salaryDue, target, after: after?.salaryDue ?? null });
    } else {
      results.push({ code: t.employeeCode, name: staff.name, status: "CORRECTED", before: before.salaryDue, target, after: after.salaryDue, correction: diff });
    }
  }
  if (apply) {
    await db.auditLog.create({ data: { entityType: "StaffLedger", entityId: TAG, action: "CORRECTION", summary: `Khata-correct: ${results.filter((r) => r.status === "CORRECTED").length} corrected, ${results.filter((r) => r.status === "ROLLED_BACK").length} rolled back (snapshot ${snap ? path.basename(snap.file) : "-"})`, actorName: session.name, actorEmail: session.email } }).catch(() => {});
  }
  return NextResponse.json({ ok: true, mode: apply ? "apply" : "dry", snapshot: snap ? path.basename(snap.file) : null, results });
}
