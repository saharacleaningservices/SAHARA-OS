"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addAutoFare, removeLoanEntry } from "@/server/actions/staff-loan";

type Loan = { id: string; date: Date; kind: string; amount: number; signedAmount: number; fromSalary: boolean; description: string | null; source: string; createdByName: string | null };
const inr = (n: number) => `₹${Math.abs(n).toLocaleString("en-IN")}`;

/** Office view of the worker's money: same numbers as the Staff App + loan entry (Super Admin / Accounts). */
export function StaffMoneyCard({
  staffId,
  salaryDue,
  loan,
  cutover,
  entries,
  canManage,
}: {
  staffId: string;
  salaryDue: number;
  loan: { given: number; paid: number; remaining: number };
  cutover: Date | null;
  entries: Loan[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [fare, setFare] = useState("");
  const [fareNote, setFareNote] = useState("");
  function saveFare() {
    start(async () => {
      const res = await addAutoFare({ staffId, amount: Number(fare), date, description: fareNote });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Auto fare added");
      setFare("");
      setFareNote("");
      router.refresh();
    });
  }
  function remove(id: string) {
    if (!confirm("Remove this loan entry? It is kept in the audit trail (soft-delete).")) return;
    start(async () => {
      const res = await removeLoanEntry(id);
      if ("error" in res && res.error) return void toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="size-4 text-primary" /> Salary &amp; loan
        </CardTitle>
        {cutover && <p className="text-xs text-muted-foreground">Includes Khata Book history up to {new Date(cutover).toLocaleDateString("en-IN")}.</p>}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className={`rounded-lg p-2.5 ${salaryDue >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
            <p className="text-xs text-muted-foreground">{salaryDue >= 0 ? "Salary due (we give)" : "Advance (we get)"}</p>
            <p className={`text-lg font-bold ${salaryDue >= 0 ? "text-success" : "text-destructive"}`}>{inr(salaryDue)}</p>
          </div>
          <div className="rounded-lg bg-indigo-50 p-2.5 dark:bg-indigo-950/40">
            <p className="text-xs text-muted-foreground">Loan given</p>
            <p className="text-lg font-bold">{inr(loan.given)}</p>
          </div>
          <div className="rounded-lg bg-indigo-50 p-2.5 dark:bg-indigo-950/40">
            <p className="text-xs text-muted-foreground">Loan repaid</p>
            <p className="text-lg font-bold">{inr(loan.paid)}</p>
          </div>
          <div className="rounded-lg bg-indigo-600 p-2.5 text-white">
            <p className="text-xs opacity-80">Loan remaining</p>
            <p className="text-lg font-bold">{inr(loan.remaining)}</p>
          </div>
        </div>

        {canManage && <p className="text-xs text-muted-foreground">Loan given / loan recovery: use the Khata ledger → Add payment (one entry point).</p>}

        {canManage && (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[7rem_9rem_1fr_auto] sm:items-end">
            <label className="text-xs">
              Auto fare ₹
              <Input inputMode="decimal" value={fare} onChange={(e) => setFare(e.target.value)} className="mt-0.5 h-9" />
            </label>
            <label className="text-xs">
              Date
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-0.5 h-9" />
            </label>
            <Input placeholder="Site / note" value={fareNote} onChange={(e) => setFareNote(e.target.value)} className="h-9" />
            <Button variant="outline" onClick={saveFare} disabled={pending || !(Number(fare) > 0)}>
              Add auto fare
            </Button>
          </div>
        )}

        {entries.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.date).toLocaleDateString("en-IN")} · {e.source === "KHATABOOK" ? "Khata Book" : (e.createdByName ?? "")}
                  </p>
                  <p className="truncate">{e.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${e.signedAmount > 0 ? "text-indigo-700" : "text-success"}`}>
                    {e.signedAmount > 0 ? "Given" : e.fromSalary ? "Cut from salary" : "Repaid"} {inr(e.amount)}
                  </span>
                  {canManage && e.source !== "KHATABOOK" && (
                    <button type="button" onClick={() => remove(e.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
