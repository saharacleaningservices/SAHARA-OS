import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getStaffMoney } from "@/server/staff-balance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type KRow = { row: number; date: string; details: string; debit: number; credit: number };
type KEmp = { employeeCode: string; khataName: string; liveBalance: number | null; entries: KRow[] };
const r2 = (n: number) => Math.round(n * 100) / 100;
const IST_MS = 5.5 * 3600 * 1000;
const ymd = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);

/**
 * READ-ONLY (Super Admin). POST { employees: [{ employeeCode, khataName, liveBalance, entries }] }.
 * Per employee: CRM balance vs Khatabook live balance, and a transaction-level match of every Khatabook row dated after
 * the staff's ledger cutover against what the CRM holds after the cutover (imported + manual + attendance/advance).
 * Khata sign: credit = Sahara owes the worker (earning), debit = paid / advance. Writes nothing.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  let body: { employees?: KEmp[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const out = [];
  for (const e of (body.employees ?? []).slice(0, 40)) {
    const staff = await db.staff.findFirst({ where: { employeeCode: e.employeeCode, deletedAt: null }, select: { id: true, name: true, ledgerCutoverAt: true } });
    if (!staff) { out.push({ employeeCode: e.employeeCode, error: "staff not found" }); continue; }
    const money = await getStaffMoney(staff.id);
    const cut = staff.ledgerCutoverAt;
    const cutDay = cut ? ymd(cut) : "0000-00-00";
    const ledger = await db.staffLedgerEntry.findMany({ where: { staffId: staff.id, deletedAt: null, date: { gt: cut ?? new Date(0) } }, select: { id: true, date: true, kind: true, signedAmount: true, description: true, source: true, createdByName: true } });
    const att = await db.attendance.findMany({ where: { staffId: staff.id, date: { gt: cut ?? new Date(0) } }, select: { date: true, status: true, wageForDay: true } });
    const adv = await db.advance.findMany({ where: { staffId: staff.id, givenAt: { gt: cut ?? new Date(0) } }, select: { givenAt: true, amount: true, reason: true } });
    const crm = [
      ...ledger.map((l) => ({ ref: `L:${l.id}`, date: ymd(l.date), signed: l.signedAmount, text: `${l.kind} ${l.description ?? ""} [${l.source}${l.createdByName ? " " + l.createdByName : ""}]` })),
      ...att.map((a) => ({ ref: `A:${ymd(a.date)}`, date: ymd(a.date), signed: a.wageForDay ?? 0, text: `ATT ${a.status}` })),
      ...adv.map((a) => ({ ref: `V:${ymd(a.givenAt)}`, date: ymd(a.givenAt), signed: -a.amount, text: `ADVANCE ${a.reason ?? ""}` })),
    ];
    const khata = (e.entries ?? []).filter((r) => r.date > cutDay && (r.debit > 0 || r.credit > 0)).map((r) => ({ row: r.row, date: r.date, signed: r2(r.credit - r.debit), text: r.details }));
    // Greedy match: same signed amount, nearest date within 3 days.
    const used = new Set<number>();
    const matched: unknown[] = [];
    const khataOnly: unknown[] = [];
    for (const k of khata) {
      let best = -1, bd = 99;
      crm.forEach((c, i) => {
        if (used.has(i) || Math.abs(c.signed - k.signed) > 0.5) return;
        const d = Math.abs((Date.parse(c.date) - Date.parse(k.date)) / 86400000);
        if (d <= 3 && d < bd) { best = i; bd = d; }
      });
      if (best >= 0) { used.add(best); matched.push({ k: k.row, date: k.date, amt: k.signed, crm: crm[best].ref }); } else khataOnly.push(k);
    }
    const crmOnly = crm.filter((_, i) => !used.has(i) && Math.abs(_.signed) > 0);
    // Possible duplicate groups inside the CRM itself (same day + amount).
    const seen = new Map<string, string[]>();
    for (const c of crm) { const key = `${c.date}|${c.signed}`; seen.set(key, [...(seen.get(key) ?? []), c.ref]); }
    const crmDupes = [...seen.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ key: k, refs: v }));
    out.push({
      employeeCode: e.employeeCode, staff: staff.name, cutover: cutDay,
      crmSalaryDue: money?.salaryDue ?? null, crmLoan: money?.loan.remaining ?? null,
      khataLive: e.liveBalance, diff: e.liveBalance == null || !money ? null : r2(money.salaryDue - e.liveBalance),
      khataRowsAfterCut: khata.length, matched: matched.length, khataOnly, crmOnly, crmDupes,
    });
  }
  return NextResponse.json({ ok: true, results: out });
}
