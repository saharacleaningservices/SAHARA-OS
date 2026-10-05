"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Upload, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { applyKhataImport, previewKhataImport, rollbackKhataImport } from "@/server/actions/khata-import";

type Plan = {
  khataName: string;
  staffName: string;
  action: string;
  existingName: string | null;
  mode: string;
  rows: number;
  net: number;
  opening: number;
  liveBalance: number | null;
  expectedSalaryDue: number | null;
  loan: { party: string; net: number; opening: number; live: number | null } | null;
  status: string;
  blocks: string[];
  notes: string[];
};
type Result = { staffName: string; khataName: string; status: string; khata: number | null; app: number | null; diff: number | null; loanKhata?: number | null; loanApp?: number | null; message?: string };
type Batch = { id: string; status: string; sourceName: string | null; sourceRows: number | null; createdByName: string | null; createdAt: Date; appliedAt: Date | null; rolledBackAt: Date | null; resultJson: string | null; snapshotFile: string | null };

const inr = (n: number | null | undefined) => (n == null ? "—" : `₹${n.toLocaleString("en-IN")}`);
const bal = (n: number | null | undefined) => (n == null ? "—" : n >= 0 ? `Give ${inr(n)}` : `Get ${inr(-n)}`);
const tone = (s: string) =>
  s === "READY" || s === "MIGRATED" ? "bg-success/15 text-success" : s === "BLOCKED" || s === "ROLLED_BACK" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";

export function KhataImportManager({ batches }: { batches: Batch[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [json, setJson] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ batchId: string; plans: Plan[]; excluded: string[] } | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  // Editable copy of the dataset: live balances / approvals are entered here and re-checked.
  type DsEmp = { staffName: string; liveBalance: number | null; liveSource: string | null; openingApproved: boolean; createNew: boolean; loan: { khataName: string; liveBalance: number | null; liveSource: string | null; openingApproved: boolean } | null };
  const [ds, setDs] = useState<{ employees: DsEmp[] } & Record<string, unknown> | null>(null);
  const editEmp = (name: string, patch: Partial<DsEmp> & { loanPatch?: Partial<NonNullable<DsEmp["loan"]>> }) =>
    setDs((d) => {
      if (!d) return d;
      return {
        ...d,
        employees: d.employees.map((e) => {
          if (e.staffName !== name) return e;
          const { loanPatch, ...rest } = patch;
          return { ...e, ...rest, loan: e.loan && loanPatch ? { ...e.loan, ...loanPatch } : e.loan };
        }),
      };
    });

  function runPreview() {
    const body = ds ? JSON.stringify(ds) : json;
    if (!body) return;
    start(async () => {
      const res = await previewKhataImport(body);
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("plans" in res) setPreview({ batchId: res.batchId!, plans: res.plans as Plan[], excluded: res.excluded ?? [] });
      setResults(null);
    });
  }
  function runApply() {
    if (!preview) return;
    if (!confirm("Apply import? A database snapshot is taken first. Only employees that reconcile to ₹0 are kept.")) return;
    start(async () => {
      const res = await applyKhataImport(preview.batchId);
      if ("error" in res && res.error) return void toast.error(res.error);
      if ("results" in res) setResults(res.results as Result[]);
      toast.success(`Import finished — snapshot ${"snapshot" in res ? res.snapshot : ""}`);
      setPreview(null);
      router.refresh();
    });
  }
  function rollback(id: string) {
    if (!confirm("Roll back this batch? Imported rows are soft-deleted (kept for audit) and balances return to before the import.")) return;
    start(async () => {
      const res = await rollbackKhataImport(id);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Batch rolled back");
      router.refresh();
    });
  }

  const ready = preview?.plans.filter((p) => p.status === "READY").length ?? 0;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-success" /> Safety rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>1. Preview never writes data. 2. Apply takes a database snapshot first. 3. An employee is kept only if Staff App balance = Khata Book balance (₹0 difference); otherwise rolled back and flagged. 4. Every Khata row is logged and can never be imported twice. 5. Nothing is ever hard-deleted — rollback soft-deletes.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 · Upload dataset</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Upload className="size-4" /> {fileName || "Choose khata-dataset.json"}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setFileName(f.name);
                const text = await f.text();
                setJson(text);
                try {
                  setDs(JSON.parse(text));
                } catch {
                  setDs(null);
                }
                setPreview(null);
                setResults(null);
              }}
            />
          </label>
          <Button onClick={runPreview} disabled={!json || pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Preview (no changes)
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">2 · Preview — {ready} of {preview.plans.length} ready</CardTitle>
            <div className="flex gap-2">
            <Button variant="outline" onClick={runPreview} disabled={pending}>Re-check after edits</Button>
            <Button onClick={runApply} disabled={!ready || pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null} Apply {ready} employee(s)
            </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-2">Khata party → Staff App name</th>
                  <th className="p-2">Rows</th>
                  <th className="p-2">Imported net</th>
                  <th className="p-2">Opening carried</th>
                  <th className="p-2">Khata live</th>
                  <th className="p-2">Staff App after</th>
                  <th className="p-2">Loan</th>
                  <th className="p-2">Status / notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.plans.map((p) => (
                  <tr key={p.staffName} className="border-t align-top">
                    <td className="p-2">
                      <div className="font-medium">{p.staffName}</div>
                      <div className="text-muted-foreground">
                        {p.khataName} · {p.action === "LINK" ? `link to ${p.existingName}` : "new staff"} · {p.mode}
                      </div>
                    </td>
                    <td className="p-2">{p.rows}</td>
                    <td className="p-2">{bal(p.net)}</td>
                    <td className="p-2">{p.opening ? bal(p.opening) : "—"}</td>
                    <td className="p-2">
                      <LiveInput
                        value={ds?.employees.find((e) => e.staffName === p.staffName)?.liveBalance ?? null}
                        onChange={(v) => editEmp(p.staffName, { liveBalance: v, liveSource: "entered by Super Admin from live Khata Book" })}
                      />
                      {p.opening !== 0 && p.liveBalance != null && (
                        <label className="mt-1 flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={ds?.employees.find((e) => e.staffName === p.staffName)?.openingApproved ?? false}
                            onChange={(ev) => editEmp(p.staffName, { openingApproved: ev.target.checked })}
                          />
                          approve opening
                        </label>
                      )}
                      {p.blocks.some((b) => b.includes("similar staff")) && (
                        <label className="mt-1 flex items-center gap-1">
                          <input type="checkbox" checked={ds?.employees.find((e) => e.staffName === p.staffName)?.createNew ?? false} onChange={(ev) => editEmp(p.staffName, { createNew: ev.target.checked })} />
                          create new staff
                        </label>
                      )}
                    </td>
                    <td className="p-2">{p.mode === "LOAN" ? "—" : bal(p.expectedSalaryDue)}</td>
                    <td className="p-2">
                      {p.loan ? (
                        <>
                          <div className="text-muted-foreground">{p.loan.party} · imported {inr(p.loan.net)}</div>
                          {p.mode !== "LOAN" && (
                            <>
                              <LiveInput
                                value={ds?.employees.find((e) => e.staffName === p.staffName)?.loan?.liveBalance ?? null}
                                onChange={(v) => editEmp(p.staffName, { loanPatch: { liveBalance: v, liveSource: "entered by Super Admin from live Khata Book" } })}
                              />
                              {p.loan.opening !== 0 && p.loan.live != null && (
                                <label className="mt-1 flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={ds?.employees.find((e) => e.staffName === p.staffName)?.loan?.openingApproved ?? false}
                                    onChange={(ev) => editEmp(p.staffName, { loanPatch: { openingApproved: ev.target.checked } })}
                                  />
                                  approve loan opening
                                </label>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${tone(p.status)}`}>{p.status}</span>
                      {[...p.blocks, ...p.notes].map((n) => (
                        <div key={n} className="mt-1 text-muted-foreground">
                          • {n}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.excluded.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Excluded: {preview.excluded.join(", ")}</p>}
          </CardContent>
        </Card>
      )}

      {results && <ResultTable results={results} title="3 · Final reconciliation" />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {batches.length === 0 && <p className="text-muted-foreground">No imports yet.</p>}
          {batches
            .filter((b) => b.status !== "PREVIEW")
            .map((b) => (
              <div key={b.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${tone(b.status === "APPLIED" ? "MIGRATED" : b.status === "ROLLED_BACK" ? "BLOCKED" : "FAILED")}`}>{b.status}</span>{" "}
                    {b.sourceName} · {new Date(b.createdAt).toLocaleString("en-IN")} · {b.createdByName}
                  </div>
                  {(b.status === "APPLIED" || b.status === "PARTIAL") && (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => rollback(b.id)}>
                      <Undo2 className="size-3.5" /> Roll back batch
                    </Button>
                  )}
                </div>
                {b.snapshotFile && <p className="mt-1 text-xs text-muted-foreground">Snapshot: {b.snapshotFile.split(/[\\/]/).pop()}</p>}
                {b.resultJson && b.status !== "FAILED" && <ResultTable results={JSON.parse(b.resultJson) as Result[]} compact />}
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ResultTable({ results, title, compact }: { results: Result[]; title?: string; compact?: boolean }) {
  const body = (
    <table className="w-full text-left text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="p-2">Employee</th>
          <th className="p-2">Khata balance</th>
          <th className="p-2">Staff App balance</th>
          <th className="p-2">Difference</th>
          <th className="p-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <tr key={r.staffName} className="border-t align-top">
            <td className="p-2">
              {r.staffName}
              <div className="text-muted-foreground">{r.khataName}</div>
            </td>
            <td className="p-2">{bal(r.khata)}{r.loanKhata != null ? ` · loan ${inr(r.loanKhata)}` : ""}</td>
            <td className="p-2">{bal(r.app)}{r.loanApp != null ? ` · loan ${inr(r.loanApp)}` : ""}</td>
            <td className="p-2">{r.diff == null ? "—" : inr(r.diff)}</td>
            <td className="p-2">
              <span className={`rounded px-1.5 py-0.5 font-semibold ${tone(r.status)}`}>{r.status}</span>
              {r.message && <div className="mt-1 text-muted-foreground">{r.message}</div>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (compact) return <div className="mt-2 overflow-x-auto">{body}</div>;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">{body}</CardContent>
    </Card>
  );
}

/** Live Khata balance: + = "You'll Give" (Sahara owes), − = "You'll Get". For loans: outstanding amount. */
function LiveInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <input
      inputMode="decimal"
      className="h-7 w-24 rounded border bg-background px-1.5"
      placeholder="± amount"
      defaultValue={value ?? ""}
      onBlur={(e) => onChange(e.target.value.trim() === "" ? null : Number(e.target.value))}
      title="+ = You'll Give, − = You'll Get"
    />
  );
}
