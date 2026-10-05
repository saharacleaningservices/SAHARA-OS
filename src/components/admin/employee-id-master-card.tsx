"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IdCard, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { applyEmployeeIdMaster } from "@/server/actions/employee-id-master";

type Row = { code: string; name: string; staffId: string | null; currentCode: string | null; currentName: string | null; status: string; note?: string };

const BADGE: Record<string, string> = {
  UPDATE: "bg-warning/15 text-warning",
  DONE: "bg-success/15 text-success",
  AT_KHATA_IMPORT: "bg-muted text-muted-foreground",
  MISSING: "bg-destructive/15 text-destructive",
  CONFLICT: "bg-destructive/15 text-destructive",
};

/** Owner-approved Employee ID master: shows current → final ID; Apply re-codes existing records in place. */
export function EmployeeIdMasterCard({ rows: initial }: { rows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const todo = rows.filter((r) => r.status === "UPDATE").length;
  const blocked = rows.some((r) => r.status === "MISSING" || r.status === "CONFLICT");

  function apply() {
    if (!confirm(`Re-code ${todo} existing staff record(s) to their permanent Employee ID? Only the ID and display name change.`)) return;
    start(async () => {
      const res = await applyEmployeeIdMaster();
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("rows" in res && res.rows) setRows(res.rows);
      toast.success(`Employee IDs applied (${"updated" in res ? res.updated : 0} staff, ${"jobsUpdated" in res ? res.jobsUpdated : 0} job teams)`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <IdCard className="size-4 text-primary" /> Employee ID master (SCS-0001 – SCS-0021)
          </span>
          <Button size="sm" onClick={apply} disabled={pending || todo === 0 || blocked}>
            {pending && <Loader2 className="size-4 animate-spin" />} {todo ? `Apply ${todo} ID change(s)` : "All applied"}
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Run this before the Khata import. Changes only the Employee ID and display name of existing staff (and the ID copies in saved job teams). Attendance, salary, loan,
          payment and Khata history are linked by record and stay untouched. New staff continue from SCS-0022.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left">Employee ID</th>
                <th className="px-2 py-1.5 text-left">Staff name</th>
                <th className="px-2 py-1.5 text-left">Current</th>
                <th className="px-2 py-1.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.code}>
                  <td className="px-2 py-1.5 font-mono font-semibold">{r.code}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.currentCode ? `${r.currentCode} · ${r.currentName}` : "—"}</td>
                  <td className="px-2 py-1.5">
                    <span className={`rounded-full px-2 py-0.5 font-semibold ${BADGE[r.status] ?? ""}`}>{r.status.replace(/_/g, " ")}</span>
                    {r.note && <span className="ml-1 text-muted-foreground">{r.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
