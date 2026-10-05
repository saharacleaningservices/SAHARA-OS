"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Clock4, CreditCard, History, Loader2, PencilLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maskTail } from "@/lib/utils";
import { correctStaffEntry, createOvertime, decideOvertime, recordStaffTransaction, saveStaffPaymentDetails } from "@/server/actions/staff-money";

const inr = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const ymd = (d: Date) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

type Line = { id: string | null; date: Date; text: string; kind: string; bucket: string; source: string; credit: number; debit: number; balance: number; reversed: boolean };
type Loan = { id: string; date: Date; kind: string; amount: number; signedAmount: number; bucket: string; text: string; source: string; createdByName: string | null; reason: string | null; reversed: boolean };
type Ot = { id: string; date: Date; regularHours: number; otHours: number; otRate: number; otAmount: number; reason: string | null; status: string; createdByName: string | null; approvedByName: string | null };
type PayDetails = { bankName: string | null; bankAccountName: string | null; bankAccount: string | null; bankIfsc: string | null; upiId: string | null; gpayNumber: string | null };
type Summary = { earned: number; autoFare: number; bonus: number; adjustment: number; opening: number; salaryPaid: number; advance: number; deductions: number; salaryDue: number };
type LoanSum = { opening: number; given: number; recovered: number; remaining: number };
type AuditRow = { id: string; action: string; summary: string; by: string | null; at: Date; old: string | null; next: string | null; reason: string | null };

const BASE_TYPES = [
  ["SALARY", "Salary paid"],
  ["ADVANCE", "Advance"],
  ["LOAN", "Loan given"],
  ["LOAN_RECOVERY", "Loan recovery"],
  ["BONUS", "Bonus"],
  ["ADJUSTMENT", "Adjustment"],
  ["EXPENSE", "Expense (we owe worker)"],
  ["OTHER", "Other"],
] as const;
const MODES = [
  ["CASH", "Cash"],
  ["UPI", "UPI"],
  ["GOOGLE_PAY", "Google Pay"],
  ["BANK_TRANSFER", "Bank transfer"],
  ["OTHER", "Other"],
] as const;
const KIND_LABEL: Record<string, string> = {
  SALARY_PAID: "Salary paid",
  PAYMENT: "Salary paid",
  ADVANCE: "Advance",
  BONUS: "Bonus",
  REWARD: "Bonus",
  FINE: "Deduction",
  DEDUCTION: "Deduction",
  ADJUSTMENT: "Adjustment",
  EXPENSE: "Expense owed",
  OTHER: "Other",
  AUTO_FARE: "Auto fare",
  OVERTIME: "Overtime",
  EARNING: "Work",
  PRESENT: "Work day",
  HALF_DAY: "Half day",
  OPENING_BALANCE: "Opening balance",
  REVERSAL: "Correction",
  LOAN_GIVEN: "Loan given",
  LOAN_OPENING: "Opening loan",
  LOAN_REPAID: "Loan recovery",
  LOAN_CORRECTION: "Correction",
};
const sel = "mt-0.5 h-9 w-full rounded-md border bg-background px-2 text-sm";

type Fix = { table: "ledger" | "loan"; id: string; label: string; oldAmount: number; oldDate: string; amount: string; date: string; note: string; reason: string; cancel: boolean };

/**
 * Money Khata — ONE Khata per employee: Summary, Ledger, Add entry, Overtime,
 * Payment details, Audit history. Add / correct only for Super Admin and
 * Accounts (server enforced); corrections never edit or delete the original.
 */
export function StaffKhataCard({
  staffId,
  summary,
  loan,
  autoFareEnabled,
  lines,
  loanEntries,
  overtime,
  details,
  audit,
  canManage,
}: {
  staffId: string;
  summary: Summary;
  loan: LoanSum;
  autoFareEnabled: boolean;
  lines: Line[];
  loanEntries: Loan[];
  overtime: Ot[];
  details: PayDetails;
  audit: AuditRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"summary" | "ledger" | "add" | "ot" | "bank" | "audit">("summary");

  const types = autoFareEnabled ? [...BASE_TYPES, ["AUTO_FARE", "Auto fare"] as const] : BASE_TYPES;
  const [f, setF] = useState({ type: "SALARY", mode: "CASH", amount: "", date: today(), reference: "", upiId: "", note: "", direction: "PAID_TO_WORKER" });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const needsDir = f.type === "ADJUSTMENT" || f.type === "OTHER";
  const isMoneyOut = !["EXPENSE", "BONUS", "LOAN_RECOVERY", "AUTO_FARE"].includes(f.type) && !(needsDir && f.direction === "OWED_TO_WORKER");

  function run(fn: () => Promise<{ error?: string } | { ok: true }>, ok: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(ok);
      after?.();
      router.refresh();
    });
  }
  function saveEntry(confirmDuplicate = false) {
    start(async () => {
      const res = await recordStaffTransaction({
        staffId,
        type: f.type,
        amount: Number(f.amount),
        date: f.date,
        mode: isMoneyOut || f.type === "LOAN_RECOVERY" ? f.mode : undefined,
        reference: f.reference || undefined,
        upiId: f.upiId || undefined,
        note: f.note || undefined,
        direction: needsDir ? f.direction : undefined,
        confirmDuplicate,
      });
      if ("duplicate" in res && res.duplicate) {
        if (confirm(`${res.error}\n\nSave it as a separate entry?`)) saveEntry(true);
        return;
      }
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Saved");
      setF((p) => ({ ...p, amount: "", reference: "", upiId: "", note: "" }));
      router.refresh();
    });
  }

  const [fix, setFix] = useState<Fix | null>(null);
  const openFix = (table: Fix["table"], id: string, label: string, amount: number, date: Date) =>
    setFix({ table, id, label, oldAmount: amount, oldDate: ymd(date), amount: String(amount), date: ymd(date), note: "", reason: "", cancel: false });
  const saveFix = () =>
    fix &&
    run(
      () =>
        correctStaffEntry({
          table: fix.table,
          id: fix.id,
          next: fix.cancel ? null : { amount: Number(fix.amount), date: fix.date, note: fix.note || undefined },
          reason: fix.reason,
        }),
      "Correction saved",
      () => setFix(null),
    );

  const [ot, setOt] = useState({ date: today(), otHours: "", regularHours: "8", otRate: "", reason: "" });
  const saveOt = () =>
    run(
      () => createOvertime({ staffId, date: ot.date, otHours: Number(ot.otHours), regularHours: Number(ot.regularHours) || 8, otRate: ot.otRate ? Number(ot.otRate) : undefined, reason: ot.reason || undefined }),
      "Overtime added (pending approval)",
      () => setOt((p) => ({ ...p, otHours: "", otRate: "", reason: "" })),
    );

  const [bank, setBank] = useState({
    bankName: details.bankName ?? "",
    bankAccountName: details.bankAccountName ?? "",
    bankAccount: details.bankAccount ?? "",
    bankIfsc: details.bankIfsc ?? "",
    upiId: details.upiId ?? "",
    gpayNumber: details.gpayNumber ?? "",
  });
  const [editBank, setEditBank] = useState(false);

  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button type="button" onClick={() => setTab(id)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tab === id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      {label}
    </button>
  );
  const Row = ({ label, value, sign, strong }: { label: string; value: number; sign?: "+" | "−" | "±"; strong?: boolean }) => (
    <div className={`flex items-center justify-between gap-2 py-1 ${strong ? "border-t pt-2 text-base font-bold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular-nums">
        {sign === "±" ? (value < 0 ? "− " : "+ ") : sign ? `${sign} ` : value < 0 ? "− " : ""}
        {inr(value)}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" /> Money Khata
          </span>
          <span className={`text-sm ${summary.salaryDue >= 0 ? "text-success" : "text-destructive"}`}>
            {summary.salaryDue >= 0 ? "Salary due (we give)" : "Advance (we get)"} {inr(summary.salaryDue)}
            {loan.remaining ? <span className="ml-2 text-indigo-700 dark:text-indigo-300">· Loan {inr(loan.remaining)}</span> : null}
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <TabBtn id="summary" label="Summary" />
          <TabBtn id="ledger" label="Ledger" />
          {canManage && <TabBtn id="add" label="Add entry" />}
          <TabBtn id="ot" label={`Overtime${overtime.some((o) => o.status === "PENDING") ? " •" : ""}`} />
          <TabBtn id="bank" label="Payment details" />
          {canManage && <TabBtn id="audit" label="Audit history" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {tab === "summary" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salary</p>
              <Row label="Earned" value={summary.earned} />
              {autoFareEnabled && (
                <>
                  <Row label="Auto fare" value={summary.autoFare} sign="+" />
                  <Row label="Total payable (wage + auto fare)" value={summary.earned + summary.autoFare} />
                </>
              )}
              {summary.bonus !== 0 && <Row label="Bonus" value={summary.bonus} sign="+" />}
              {summary.adjustment !== 0 && <Row label="Adjustment" value={summary.adjustment} sign="±" />}
              {summary.opening !== 0 && <Row label="Opening balance (Khata)" value={summary.opening} sign="±" />}
              <Row label="Salary paid" value={summary.salaryPaid} sign="−" />
              <Row label="Advance" value={summary.advance} sign="−" />
              {summary.deductions !== 0 && <Row label="Deductions" value={summary.deductions} sign="−" />}
              <Row label={summary.salaryDue >= 0 ? "Salary due" : "Advance outstanding"} value={summary.salaryDue} strong />
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loan (separate from salary)</p>
              <Row label="Opening loan" value={loan.opening} />
              <Row label="Loan given" value={loan.given} sign="+" />
              <Row label="Loan recovery" value={loan.recovered} sign="−" />
              <Row label="Loan remaining" value={loan.remaining} strong />
              <p className="pt-2 text-[11px] text-muted-foreground">Salary payments never reduce the loan. A loan recovery reduces only the loan.</p>
            </div>
          </div>
        )}

        {tab === "add" && canManage && (
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Type
              <select value={f.type} onChange={(e) => set("type", e.target.value)} className={sel}>
                {types.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Amount ₹
              <Input inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} className="mt-0.5 h-9" />
            </label>
            <label className="text-xs">
              Date
              <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className="mt-0.5 h-9" />
            </label>
            {needsDir && (
              <label className="text-xs">
                Direction
                <select value={f.direction} onChange={(e) => set("direction", e.target.value)} className={sel}>
                  <option value="PAID_TO_WORKER">Reduce due (worker got money)</option>
                  <option value="OWED_TO_WORKER">Increase due (we owe worker)</option>
                </select>
              </label>
            )}
            {(isMoneyOut || f.type === "LOAN_RECOVERY") && (
              <label className="text-xs">
                Payment mode
                <select value={f.mode} onChange={(e) => set("mode", e.target.value)} className={sel}>
                  {MODES.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
            )}
            {(f.mode === "UPI" || f.mode === "GOOGLE_PAY") && isMoneyOut && (
              <label className="text-xs">
                UPI ID / number
                <Input value={f.upiId} onChange={(e) => set("upiId", e.target.value)} placeholder={details.upiId ?? details.gpayNumber ?? ""} className="mt-0.5 h-9" />
              </label>
            )}
            {f.type !== "AUTO_FARE" && (
              <label className="text-xs">
                UTR / reference
                <Input value={f.reference} onChange={(e) => set("reference", e.target.value)} className="mt-0.5 h-9" />
              </label>
            )}
            <label className="text-xs sm:col-span-2">
              {needsDir ? "Reason (required)" : f.type === "AUTO_FARE" ? "Note (site / route)" : "Note"}
              <Input value={f.note} onChange={(e) => set("note", e.target.value)} className="mt-0.5 h-9" />
            </label>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => saveEntry()} disabled={pending || !(Number(f.amount) > 0) || (needsDir && !f.note.trim())}>
                {pending && <Loader2 className="size-4 animate-spin" />} Save entry
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground sm:col-span-3">
              {f.type === "LOAN_RECOVERY" ? "Loan recovery reduces only the loan — it does not change Salary due." : f.type === "SALARY" ? "Salary paid reduces Salary due only — it never reduces the loan." : "One Khata, one ledger: every entry is audit-logged and the worker gets an alert."}
            </p>
          </div>
        )}

        {tab === "ledger" && (
          <>
            {fix && (
              <div className="grid gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:grid-cols-4">
                <p className="text-xs font-semibold sm:col-span-4">
                  Correct: {fix.label} · old {inr(fix.oldAmount)} on {new Date(fix.oldDate).toLocaleDateString("en-IN")}
                </p>
                <label className="flex items-center gap-1.5 text-xs sm:col-span-4">
                  <input type="checkbox" checked={fix.cancel} onChange={(e) => setFix({ ...fix, cancel: e.target.checked })} /> Cancel this entry (no new amount)
                </label>
                {!fix.cancel && (
                  <>
                    <label className="text-xs">
                      New amount ₹
                      <Input inputMode="decimal" value={fix.amount} onChange={(e) => setFix({ ...fix, amount: e.target.value })} className="mt-0.5 h-9" />
                    </label>
                    <label className="text-xs">
                      New date
                      <Input type="date" value={fix.date} onChange={(e) => setFix({ ...fix, date: e.target.value })} className="mt-0.5 h-9" />
                    </label>
                    <label className="text-xs sm:col-span-2">
                      New note (optional)
                      <Input value={fix.note} onChange={(e) => setFix({ ...fix, note: e.target.value })} className="mt-0.5 h-9" />
                    </label>
                  </>
                )}
                <label className="text-xs sm:col-span-3">
                  Reason (required)
                  <Input value={fix.reason} onChange={(e) => setFix({ ...fix, reason: e.target.value })} className="mt-0.5 h-9" />
                </label>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={saveFix} disabled={pending || !fix.reason.trim() || (!fix.cancel && !(Number(fix.amount) > 0))}>
                    Save correction
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setFix(null)}>Close</Button>
                </div>
                <p className="text-[11px] text-muted-foreground sm:col-span-4">The old entry stays in the ledger; a correction row and the new entry are added and recorded in Audit history.</p>
              </div>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Details</th>
                    <th className="px-2 py-1.5 text-right">Owed (+)</th>
                    <th className="px-2 py-1.5 text-right">Paid (−)</th>
                    <th className="px-2 py-1.5 text-right">Balance</th>
                    {canManage && <th className="px-2 py-1.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.slice(0, 120).map((l, i) => (
                    <tr key={l.id ?? i} className={l.reversed ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}>
                      <td className="whitespace-nowrap px-2 py-1.5">{new Date(l.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-2 py-1.5">
                        <span className="font-medium">{KIND_LABEL[l.kind] ?? l.kind}</span>
                        {l.text ? ` · ${l.text}` : ""}
                        {l.source === "KHATABOOK" ? <span className="ml-1 text-muted-foreground">(Khata)</span> : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-success">{l.credit ? inr(l.credit) : ""}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-destructive">{l.debit ? inr(l.debit) : ""}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{l.balance < 0 ? "−" : ""}{inr(l.balance)}</td>
                      {canManage && (
                        <td className="px-2 py-1.5 text-right">
                          {l.id && l.kind !== "REVERSAL" && !l.reversed ? (
                            <button type="button" className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-primary" disabled={pending} onClick={() => openFix("ledger", l.id!, KIND_LABEL[l.kind] ?? l.kind, l.credit || l.debit, l.date)}>
                              <PencilLine className="size-3.5" /> Correct
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-3 text-center text-muted-foreground">No entries this year</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">Attendance days, overtime and older advance/fine records are corrected in Attendance / Overtime.</p>

            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">Loan ledger (separate)</p>
              <ul className="divide-y rounded-lg border">
                {loanEntries.map((e) => (
                  <li key={e.id} className={`flex items-center justify-between gap-2 px-3 py-1.5 text-xs ${e.reversed ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""}`}>
                    <div className="min-w-0">
                      <span className="text-muted-foreground">
                        {new Date(e.date).toLocaleDateString("en-IN")} · {e.source === "KHATABOOK" ? "Khata Book" : (e.createdByName ?? "")}
                      </span>
                      <p className="truncate">
                        <span className="font-medium">{KIND_LABEL[e.kind] ?? e.kind}</span>
                        {e.text ? ` · ${e.text}` : ""}
                        {e.reason && e.kind === "LOAN_CORRECTION" ? ` · ${e.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`font-semibold ${e.signedAmount > 0 ? "text-indigo-700 dark:text-indigo-300" : "text-success"}`}>
                        {e.signedAmount > 0 ? "+" : "−"}
                        {inr(e.amount)}
                      </span>
                      {canManage && e.kind !== "LOAN_CORRECTION" && !e.reversed && (
                        <button type="button" className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-primary" disabled={pending} onClick={() => openFix("loan", e.id, KIND_LABEL[e.kind] ?? e.kind, e.amount, e.date)}>
                          <PencilLine className="size-3.5" /> Correct
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {loanEntries.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">No loan entries</li>}
              </ul>
            </div>
          </>
        )}

        {tab === "ot" && (
          <>
            {canManage && (
              <div className="grid gap-2 sm:grid-cols-[9rem_5rem_5rem_6rem_1fr_auto] sm:items-end">
                <label className="text-xs">
                  Date
                  <Input type="date" value={ot.date} onChange={(e) => setOt({ ...ot, date: e.target.value })} className="mt-0.5 h-9" />
                </label>
                <label className="text-xs">
                  Regular h
                  <Input inputMode="decimal" value={ot.regularHours} onChange={(e) => setOt({ ...ot, regularHours: e.target.value })} className="mt-0.5 h-9" />
                </label>
                <label className="text-xs">
                  OT h
                  <Input inputMode="decimal" value={ot.otHours} onChange={(e) => setOt({ ...ot, otHours: e.target.value })} className="mt-0.5 h-9" />
                </label>
                <label className="text-xs">
                  Rate ₹/h
                  <Input inputMode="decimal" placeholder="auto" value={ot.otRate} onChange={(e) => setOt({ ...ot, otRate: e.target.value })} className="mt-0.5 h-9" />
                </label>
                <Input placeholder="Reason / job" value={ot.reason} onChange={(e) => setOt({ ...ot, reason: e.target.value })} className="h-9" />
                <Button onClick={saveOt} disabled={pending || !(Number(ot.otHours) > 0)}>
                  <Clock4 className="size-4" /> Add
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">Auto rate = day wage ÷ regular hours. Overtime counts in the Khata only after approval.</p>
            <ul className="divide-y rounded-lg border">
              {overtime.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs">
                  <div>
                    <span className="font-medium">{new Date(o.date).toLocaleDateString("en-IN")}</span> · {o.otHours} h × ₹{o.otRate} = <b>{inr(o.otAmount)}</b>
                    {o.reason ? ` · ${o.reason}` : ""}
                    <span className="block text-muted-foreground">by {o.createdByName}{o.approvedByName ? ` · ${o.status.toLowerCase()} by ${o.approvedByName}` : ""}</span>
                  </div>
                  {o.status === "PENDING" && canManage ? (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => decideOvertime(o.id, true), "Approved")}>Approve</Button>
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => decideOvertime(o.id, false), "Rejected")}>Reject</Button>
                    </div>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${o.status === "APPROVED" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{o.status}</span>
                  )}
                </li>
              ))}
              {overtime.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">No overtime recorded</li>}
            </ul>
          </>
        )}

        {tab === "bank" &&
          (editBank && canManage ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["bankAccountName", "Account holder name"],
                  ["bankName", "Bank name"],
                  ["bankAccount", "Account number"],
                  ["bankIfsc", "IFSC"],
                  ["upiId", "UPI ID"],
                  ["gpayNumber", "Google Pay number"],
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="text-xs">
                  {l}
                  <Input value={bank[k]} onChange={(e) => setBank({ ...bank, [k]: e.target.value })} className="mt-0.5 h-9" autoComplete="off" />
                </label>
              ))}
              <div className="flex gap-2 sm:col-span-2">
                <Button disabled={pending} onClick={() => run(() => saveStaffPaymentDetails({ staffId, ...bank }), "Payment details saved", () => setEditBank(false))}>
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditBank(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Account holder</dt><dd>{details.bankAccountName || "—"}</dd>
                <dt className="text-muted-foreground">Bank</dt><dd>{details.bankName || "—"}</dd>
                <dt className="text-muted-foreground">Account no.</dt><dd className="font-mono">{maskTail(details.bankAccount) || "—"}</dd>
                <dt className="text-muted-foreground">IFSC</dt><dd className="font-mono">{details.bankIfsc || "—"}</dd>
                <dt className="text-muted-foreground">UPI ID</dt><dd>{details.upiId || "—"}</dd>
                <dt className="text-muted-foreground">Google Pay</dt><dd className="font-mono">{maskTail(details.gpayNumber) || "—"}</dd>
              </dl>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setEditBank(true)}>
                  <CreditCard className="size-3.5" /> Edit payment details
                </Button>
              )}
            </div>
          ))}

        {tab === "audit" && canManage && (
          <ul className="divide-y rounded-lg border">
            {audit.map((a) => (
              <li key={a.id} className="space-y-0.5 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <History className="size-3.5" /> {a.action.replace("MONEY_", "").replaceAll("_", " ").toLowerCase()}
                  </span>
                  <span>
                    {a.by ?? "—"} · {new Date(a.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                {a.old ? (
                  <p>
                    <span className="text-muted-foreground">Old</span> {a.old} → <span className="text-muted-foreground">New</span> {a.next} · <span className="text-muted-foreground">Reason</span> {a.reason}
                  </p>
                ) : (
                  <p>{a.summary}</p>
                )}
              </li>
            ))}
            {audit.length === 0 && <li className="px-3 py-3 text-center text-xs text-muted-foreground">No changes recorded yet</li>}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
