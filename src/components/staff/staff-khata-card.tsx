"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Clock4, CreditCard, Loader2, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { maskTail } from "@/lib/utils";
import { createOvertime, decideOvertime, recordStaffTransaction, reverseStaffTransaction, saveStaffPaymentDetails } from "@/server/actions/staff-money";

const inr = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

type Line = { date: Date; text: string; kind: string; source: string; credit: number; debit: number; balance: number };
type Manual = { id: string; date: Date; kind: string; amount: number; signedAmount: number; description: string | null; paymentMode: string | null; reference: string | null; reason: string | null; createdByName: string | null; reversed: boolean };
type Ot = { id: string; date: Date; regularHours: number; otHours: number; otRate: number; otAmount: number; reason: string | null; status: string; createdByName: string | null; approvedByName: string | null };
type PayDetails = { bankName: string | null; bankAccountName: string | null; bankAccount: string | null; bankIfsc: string | null; upiId: string | null; gpayNumber: string | null };

const TYPES = [
  ["SALARY", "Salary paid"],
  ["ADVANCE", "Advance"],
  ["LOAN", "Loan given"],
  ["LOAN_RECOVERY", "Loan recovery"],
  ["EXPENSE", "Expense (we owe worker)"],
  ["BONUS", "Bonus"],
  ["ADJUSTMENT", "Adjustment"],
  ["OTHER", "Other"],
] as const;
const MODES = [
  ["CASH", "Cash"],
  ["UPI", "UPI"],
  ["GOOGLE_PAY", "Google Pay"],
  ["BANK_TRANSFER", "Bank transfer"],
  ["OTHER", "Other"],
] as const;
const sel = "mt-0.5 h-9 w-full rounded-md border bg-background px-2 text-sm";

/** Office: payment entry, Khata ledger with running balance, reversals, overtime approval, payment details. Super Admin + Accounts only. */
export function StaffKhataCard({ staffId, balance, lines, manual, overtime, details }: { staffId: string; balance: number; lines: Line[]; manual: Manual[]; overtime: Ot[]; details: PayDetails }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<"pay" | "ledger" | "ot" | "bank">("pay");

  const [f, setF] = useState({ type: "SALARY", mode: "CASH", amount: "", date: today(), reference: "", upiId: "", note: "", direction: "PAID_TO_WORKER", fromSalary: true });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const needsDir = f.type === "ADJUSTMENT" || f.type === "OTHER";
  const isMoneyOut = !["EXPENSE", "BONUS", "LOAN_RECOVERY"].includes(f.type) && !(needsDir && f.direction === "OWED_TO_WORKER");

  function run(fn: () => Promise<{ error?: string } | { ok: true }>, ok: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success(ok);
      after?.();
      router.refresh();
    });
  }
  const savePayment = () =>
    run(
      () =>
        recordStaffTransaction({
          staffId,
          type: f.type,
          amount: Number(f.amount),
          date: f.date,
          mode: isMoneyOut || f.type === "LOAN_RECOVERY" ? f.mode : undefined,
          reference: f.reference || undefined,
          upiId: f.upiId || undefined,
          note: f.note || undefined,
          direction: needsDir ? f.direction : undefined,
          fromSalary: f.type === "LOAN_RECOVERY" ? f.fromSalary : undefined,
        }),
      "Saved",
      () => setF((p) => ({ ...p, amount: "", reference: "", upiId: "", note: "" })),
    );
  const reverse = (id: string) => {
    const reason = prompt("Reason for the reversal (required). The original entry stays in the ledger.");
    if (reason?.trim()) run(() => reverseStaffTransaction(id, reason), "Reversed");
  };

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" /> Khata ledger
          </span>
          <span className={`text-sm ${balance >= 0 ? "text-success" : "text-destructive"}`}>
            {balance >= 0 ? "We give" : "We get"} {inr(balance)}
          </span>
        </CardTitle>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <TabBtn id="pay" label="Add payment" />
          <TabBtn id="ledger" label="Ledger" />
          <TabBtn id="ot" label={`Overtime${overtime.some((o) => o.status === "PENDING") ? " •" : ""}`} />
          <TabBtn id="bank" label="Payment details" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {tab === "pay" && (
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">
              Type
              <select value={f.type} onChange={(e) => set("type", e.target.value)} className={sel}>
                {TYPES.map(([v, l]) => (
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
            {f.type === "LOAN_RECOVERY" && (
              <label className="flex items-center gap-1.5 self-end pb-2 text-xs">
                <input type="checkbox" checked={f.fromSalary} onChange={(e) => set("fromSalary", e.target.checked)} /> Cut from salary
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
            <label className="text-xs">
              UTR / reference
              <Input value={f.reference} onChange={(e) => set("reference", e.target.value)} className="mt-0.5 h-9" />
            </label>
            <label className="text-xs sm:col-span-2">
              {needsDir ? "Reason (required)" : "Note"}
              <Input value={f.note} onChange={(e) => set("note", e.target.value)} className="mt-0.5 h-9" />
            </label>
            <div className="flex items-end">
              <Button className="w-full" onClick={savePayment} disabled={pending || !(Number(f.amount) > 0) || (needsDir && !f.note.trim())}>
                {pending && <Loader2 className="size-4 animate-spin" />} Save entry
              </Button>
            </div>
          </div>
        )}

        {tab === "ledger" && (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Details</th>
                    <th className="px-2 py-1.5 text-right">Owed (+)</th>
                    <th className="px-2 py-1.5 text-right">Paid (−)</th>
                    <th className="px-2 py-1.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lines.slice(0, 80).map((l, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap px-2 py-1.5">{new Date(l.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-2 py-1.5">{l.kind === "OVERTIME" ? `Overtime · ${l.text}` : l.text || l.kind}{l.source === "KHATABOOK" ? <span className="ml-1 text-muted-foreground">(Khata)</span> : null}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-success">{l.credit ? inr(l.credit) : ""}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-destructive">{l.debit ? inr(l.debit) : ""}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{l.balance < 0 ? "−" : ""}{inr(l.balance)}</td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">No entries this year</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {manual.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Office entries — correct with a reversal (nothing is edited or deleted)</p>
                <ul className="divide-y rounded-lg border">
                  {manual.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                      <div className="min-w-0">
                        <span className="text-muted-foreground">{new Date(m.date).toLocaleDateString("en-IN")} · {m.createdByName}</span>
                        <p className="truncate">{m.description ?? m.kind}{m.paymentMode ? ` · ${m.paymentMode.replace("_", " ")}` : ""}{m.reference ? ` · Ref ${m.reference}` : ""}{m.reason && m.kind === "REVERSAL" ? ` · ${m.reason}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`font-semibold ${m.signedAmount >= 0 ? "text-success" : "text-destructive"}`}>{m.signedAmount >= 0 ? "+" : "−"}{inr(m.amount)}</span>
                        {m.reversed ? (
                          <span className="text-muted-foreground">reversed</span>
                        ) : m.kind !== "REVERSAL" ? (
                          <button type="button" onClick={() => reverse(m.id)} className="flex items-center gap-0.5 text-muted-foreground hover:text-destructive" disabled={pending}>
                            <Undo2 className="size-3.5" /> Reverse
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {tab === "ot" && (
          <>
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
            <p className="text-[11px] text-muted-foreground">Auto rate = day wage ÷ regular hours. Overtime counts in the ledger only after approval.</p>
            <ul className="divide-y rounded-lg border">
              {overtime.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-xs">
                  <div>
                    <span className="font-medium">{new Date(o.date).toLocaleDateString("en-IN")}</span> · {o.otHours} h × ₹{o.otRate} = <b>{inr(o.otAmount)}</b>
                    {o.reason ? ` · ${o.reason}` : ""}
                    <span className="block text-muted-foreground">by {o.createdByName}{o.approvedByName ? ` · ${o.status.toLowerCase()} by ${o.approvedByName}` : ""}</span>
                  </div>
                  {o.status === "PENDING" ? (
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
          (editBank ? (
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
              <Button size="sm" variant="outline" onClick={() => setEditBank(true)}>
                <CreditCard className="size-3.5" /> Edit payment details
              </Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
